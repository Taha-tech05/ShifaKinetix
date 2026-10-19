import { Answer, evaluate, questions } from '../src/gate/evaluate';
import { evaluateSessionGate } from '../src/gate/sessionAdapter';
import { levelReasons, nextSafetyStep, safetyProgress } from '../src/gate/safetyFlow';
import { safetyNarrowingFacts } from '../src/narrowing/safetyFacts';
import { lowRiskAnswers } from './support/safetyAnswers';

// The questionnaire's decisions as pure functions (contract v2). Fictional answers only.
const how = (value: string | null): Answer => ({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value, state: value === null ? 'unknown' : 'answered' });
const painNow = (value: number): Answer => ({ questionId: 'Q_BASICS_PAIN_NOW', type: 'scale0to10', value, state: 'answered' });
const step = (input: Answer[]) => nextSafetyStep(input, evaluateSessionGate(input));
/** Walks the questionnaire, answering each asked question from `pick`, and returns the ids asked and the end route. */
function walk(start: Answer[], pick: (id: string) => Answer['value']) {
  const input = [...start];
  const asked: string[] = [];
  for (let i = 0; i < 40; i += 1) {
    const next = step(input);
    if (next.kind === 'route') return { asked, to: next.to, input };
    if (next.kind === 'prefill') { input.push(next.answer); continue; }
    asked.push(next.question.questionId);
    const value = pick(next.question.questionId);
    input.push({ questionId: next.question.questionId, type: next.question.type, value, state: value === null ? 'unknown' : 'answered' });
  }
  throw new Error('no end');
}
const lowRisk = (id: string) => ({ onset: 'gradual', pain_score: 3 } as Record<string, Answer['value']>)[id] ?? false;

test('the low-risk path asks seven questions when the basics give how it started', () => {
  const out = walk([how('slowly')], lowRisk);
  expect(out.asked).toEqual(['chest', 'breathing', 'unable', 'sensation', 'inflammation', 'illness', 'pain_score']);
  expect(out.to).toBe('/report/safe');
});

test('the basics pain score is reused too: six questions', () => {
  expect(walk([how('slowly'), painNow(2)], lowRisk).asked).toHaveLength(6);
});

test('without the basics, how it started is asked once, as one question instead of two', () => {
  const out = walk([how(null)], lowRisk);
  expect(out.asked.filter((id) => id === 'onset')).toHaveLength(1);
  expect(out.asked).not.toContain('injury');
  expect(out.asked).not.toContain('sudden');
});

test('detail questions are asked only for the topic that was opened', () => {
  const out = walk([how('slowly')], (id) => (id === 'inflammation' ? true : id === 'temperature' ? 'normal' : id === 'swelling' ? 'none' : lowRisk(id)));
  expect(out.asked).toEqual(['chest', 'breathing', 'unable', 'sensation', 'inflammation', 'temperature', 'swelling', 'redness', 'fever',
    'illness', 'pain_score']);
});

test('an injury start opens the shape question; a gradual start does not', () => {
  expect(walk([how('after_injury')], lowRisk).asked).toContain('shape');
  expect(walk([how('slowly')], lowRisk).asked).not.toContain('shape');
});

test('no question is ever asked twice on any path', () => {
  const picks = [lowRisk, (id: string) => (questions.find((q) => q.questionId === id)!.tier === 'gateway' ? null : lowRisk(id))];
  for (const pick of picks) for (const basics of ['slowly', 'suddenly', 'after_injury', null]) {
    const { asked } = walk([how(basics)], pick);
    expect(new Set(asked).size).toBe(asked.length);
  }
});

const unresolved = (id: string): Answer => ({ questionId: id, type: questions.find((q) => q.questionId === id)!.type,
  value: null, state: 'unknown', clarificationAttempted: true });

test('a confirmed danger stops at once', () => {
  expect(step([how('slowly'), ...lowRiskAnswers({ chest: true })])).toEqual({ kind: 'route', to: '/report/urgent' });
});

test('one unresolved answer lets the check finish at Soon; chest, breathing or two unresolved go to unclear', () => {
  const one = [how('slowly'), ...lowRiskAnswers({}, ['unable']), unresolved('unable')];
  expect(step(one)).toEqual({ kind: 'route', to: '/report/safe' });
  expect(evaluateSessionGate(one)).toMatchObject({ verdict: 'SAFE', level: 'SOON' });
  expect(step([how('slowly'), ...lowRiskAnswers({}, ['chest']), unresolved('chest')])).toEqual({ kind: 'route', to: '/report/unclear' });
  const two = [how('slowly'), ...lowRiskAnswers({ sensation: true, tingling: 'none', temperature: 'normal' }, ['unable']),
    unresolved('unable'), unresolved('numb')];
  expect(step(two)).toEqual({ kind: 'route', to: '/report/unclear' });
});

test('a first Not sure on a hard-stop question offers its simpler question; one unresolved answer does not stop the rest', () => {
  const first = [how('slowly'), ...lowRiskAnswers({ unable: null }, ['sensation', 'inflammation', 'illness', 'pain_score'])];
  expect(step(first)).toMatchObject({ kind: 'ask', reason: 'clarify', question: { questionId: 'unable' } });
  const later = [how('slowly'), ...lowRiskAnswers({}, ['unable', 'sensation', 'inflammation', 'illness', 'pain_score']), unresolved('unable')];
  expect(step(later)).toMatchObject({ kind: 'ask', reason: 'new', question: { questionId: 'sensation' } });
});

test('every hard-stop question has a simpler question whose options are valid answers', () => {
  for (const q of questions.filter((x) => x.tier === 'hardStop')) {
    expect(q.fallback?.options.length).toBeGreaterThan(1);
    expect(q.shortName).toBeTruthy();
    for (const o of q.fallback!.options) {
      expect(evaluate([{ questionId: q.questionId, type: q.type, value: o.value, state: 'answered' }]).firedRules
        .some((r) => r.ruleId === 'INPUT_INVALID')).toBe(false);
    }
  }
});

test('a follow-up comes before any other question and is marked as such', () => {
  const next = step([how('after_injury'), ...lowRiskAnswers()]);
  expect(next).toMatchObject({ kind: 'ask', reason: 'followup', question: { questionId: 'onset' } });
});

test('progress counts only the questions that apply', () => {
  const answers = [how('slowly'), ...lowRiskAnswers({}, ['pain_score'])];
  const pain = questions.find((q) => q.questionId === 'pain_score')!;
  expect(safetyProgress(answers, pain)).toEqual({ n: 8, total: 8 });
});

test('reasons are plain and never mention points', () => {
  const soon = evaluate(lowRiskAnswers({ onset: 'injury', shape: false }));
  expect(levelReasons(soon, 'unsure')).toEqual(['The pain started after an injury or accident']);
  const emergency = evaluate(lowRiskAnswers({ chest: true }));
  expect(levelReasons(emergency, 'unsure')).toEqual(['Chest pressure or tightness']);
  const uncertain = evaluate(lowRiskAnswers({ illness: true, systemic: null, cancer: null }));
  expect(levelReasons(uncertain, 'an answer you were not sure about')).toEqual(['an answer you were not sure about']);
  expect(levelReasons(null, 'x')).toEqual([]);
});

test('narrowing reuses the safety answers about tingling and numbness', () => {
  expect(safetyNarrowingFacts(lowRiskAnswers())).toEqual([
    { questionId: 'Q_ST_TINGLE', type: 'yesno', value: false, state: 'answered' },
    { questionId: 'Q_ST_NUMB', type: 'yesno', value: false, state: 'answered' },
  ]);
  const opened = lowRiskAnswers({ sensation: true, numb: false, tingling: 'comes_goes', temperature: 'normal' });
  expect(safetyNarrowingFacts(opened).map((a) => a.value)).toEqual([true, false]);
  const unsure = lowRiskAnswers({ sensation: true, numb: null, tingling: null, temperature: 'normal' });
  expect(safetyNarrowingFacts(unsure).map((a) => a.state)).toEqual(['unknown', 'unknown']);
  // the topic not yet answered gives nothing, and an own narrowing answer is never overwritten
  expect(safetyNarrowingFacts(lowRiskAnswers({}, ['sensation']))).toEqual([]);
  expect(safetyNarrowingFacts([...lowRiskAnswers(), { questionId: 'Q_ST_NUMB', type: 'yesno', value: true, state: 'answered' }])
    .map((a) => a.questionId)).toEqual(['Q_ST_TINGLE']);
});
