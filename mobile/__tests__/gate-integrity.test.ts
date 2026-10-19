import { Answer, evaluate, GateOutput, impliedAnswer, isAskedQuestion, isValidAnswer, questions, rules, SafetyAnswer, THRESHOLDS } from '../src/gate/evaluate';
import sources from '../../shared/clinical_sources.json';
import fixtures from '../../shared/gate_test_cases.json';
import { lowRiskAnswers } from './support/safetyAnswers';

// Draft, awaiting clinician review. Structural and safety properties of contract v2 (docs/gate-contract.md).

test('every shared fixture has provenance and a draft label, with danger cases first', () => {
  let passedDangerCases = false;
  for (const item of fixtures.cases) {
    expect(item.source.trim()).not.toBe('');
    expect(item.label).toBe('draft, awaiting clinician review');
    if (item.expectedVerdict !== 'RED_FLAG') passedDangerCases = true;
    else expect(passedDangerCases).toBe(false);
  }
});

test('every question and rule is traceable, sourced, draft-labelled and well formed', () => {
  expect(new Set(questions.map((q) => q.questionId)).size).toBe(questions.length);
  expect(new Set(rules.map((r) => r.ruleId)).size).toBe(rules.length);
  for (const item of [...questions, ...rules]) {
    expect(item.label).toBe('draft, awaiting clinician review');
    expect(sources.sources.some((s) => s.url === item.source && !s.use.startsWith('Pending'))).toBe(true);
  }
  for (const rule of rules) {
    // exactly one of: a hard-stop level, or points
    expect((rule.level !== undefined) !== (rule.points !== undefined)).toBe(true);
    if (rule.points !== undefined) {
      expect(rule.all).toHaveLength(1);
      expect(rule.points).toBeGreaterThan(0);
    }
    for (const clause of rule.all) {
      const q = questions.find((x) => x.questionId === clause.questionId)!;
      expect(q).toBeDefined();
      if (clause.equals !== undefined) {
        expect(isValidAnswer({ questionId: q.questionId, type: q.type, value: clause.equals, state: 'answered' })).toBe(true);
      }
    }
    // a "Not sure" to a single-sign hard stop must ask the clarification, so the question is a hard-stop question
    if (rule.level && rule.all.length === 1) expect(questions.find((q) => q.questionId === rule.all[0].questionId)!.tier).toBe('hardStop');
  }
  expect(THRESHOLDS.SOON).toBeLessThan(THRESHOLDS.URGENT);
});

test('linked questions form no loop, and a gateway No gives a valid answer', () => {
  const opens = (id: string, seen: string[] = []): boolean => {
    const q = questions.find((x) => x.questionId === id)!;
    return (q.askWhen ?? []).every((c) => !seen.includes(c.questionId) && opens(c.questionId, [...seen, id]));
  };
  questions.forEach((q) => {
    expect(opens(q.questionId)).toBe(true);
    for (const clause of q.askWhen ?? []) {
      expect(questions.some((x) => x.questionId === clause.questionId && x.questionId !== q.questionId)).toBe(true);
    }
    if (q.deniedValue !== undefined) {
      expect(isValidAnswer({ questionId: q.questionId, type: q.type, value: q.deniedValue, state: 'answered' })).toBe(true);
    }
    expect(q.required && q.askWhen?.length).toBeFalsy();
  });
});

test('the low-risk path asks eight questions and is ROUTINE', () => {
  const answers = lowRiskAnswers();
  expect(questions.filter((q) => isAskedQuestion(q, answers))).toHaveLength(8);
  expect(evaluate(answers)).toEqual({ verdict: 'SAFE', level: 'ROUTINE', score: 0, firedRules: [] });
});

test.each(questions.filter((q) => q.required).map((q) => q.questionId))('missing or unresolved %s cannot be SAFE', (id) => {
  const without = lowRiskAnswers({}, [id]);
  expect(evaluate(without).verdict).toBe('CLARIFY');
  expect(evaluate(lowRiskAnswers({ [id]: null })).verdict).toBe('CLARIFY');
});

test('changing answer order never changes a result', () => {
  const answers = lowRiskAnswers({ onset: 'injury', shape: false, pain_score: 9, bilateral: false });
  expect(evaluate([...answers].reverse())).toEqual(evaluate(answers));
});

test.each([NaN, Infinity, -1, 11])('invalid numeric value %s fails closed', (value) => {
  expect(evaluate([...lowRiskAnswers({}, ['pain_score']), { questionId: 'pain_score', type: 'number', state: 'answered', value }]).verdict)
    .toBe('RED_FLAG');
});

test('does not mutate supplied answers', () => {
  const answers = lowRiskAnswers().map((a) => Object.freeze(a));
  expect(evaluate(Object.freeze(answers)).verdict).toBe('SAFE');
});

// ---------------------------------------------------------------- safety properties over many generated answer sets

/** ROUTINE < SOON < CLARIFY < URGENT < EMERGENCY. */
const rank = (o: GateOutput) => o.verdict === 'CLARIFY' ? 2 : ({ ROUTINE: 0, SOON: 1, URGENT: 3, EMERGENCY: 4 } as const)[o.level!];
/** Answer values from least to most worrying (choice options are declared in that order). */
function scale(id: string): SafetyAnswer['value'][] {
  const q = questions.find((x) => x.questionId === id)!;
  if (q.type === 'yesno') return [false, true];
  if (q.type === 'choice') return id === 'onset' ? ['gradual', 'sudden', 'injury'] : q.options!.map((o) => o.value);
  return q.type === 'number' ? [0, 3, 5, 6, 7, 8, 10] : [0, 10, 400];
}
function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];
function randomAnswers(r: () => number): SafetyAnswer[] {
  const out: SafetyAnswer[] = [];
  for (const q of questions) {
    const roll = r();
    if (roll < 0.15) continue;
    if (roll < 0.25) { out.push({ questionId: q.questionId, type: q.type as SafetyAnswer['type'], value: null, state: 'unknown', clarificationAttempted: r() < 0.5 }); continue; }
    // mostly the lowest value, so many sets reach SAFE
    const values = scale(q.questionId);
    out.push({ questionId: q.questionId, type: q.type as SafetyAnswer['type'], value: r() < 0.6 ? values[0] : pick(r, values), state: 'answered' });
  }
  return out;
}
const replace = (answers: SafetyAnswer[], a: SafetyAnswer) => [...answers.filter((x) => x.questionId !== a.questionId), a];
const SAMPLES = 1500;

test('a more worrying answer never lowers the care level', () => {
  const r = rng(7);
  for (let i = 0; i < SAMPLES; i += 1) {
    const answers = randomAnswers(r);
    const before = rank(evaluate(answers));
    for (const a of answers.filter((x) => x.state === 'answered')) {
      const values = scale(a.questionId);
      const at = values.findIndex((v) => v === a.value);
      for (const worse of values.slice(at + 1)) {
        expect(rank(evaluate(replace(answers, { ...a, value: worse })))).toBeGreaterThanOrEqual(before);
      }
    }
  }
});

test('"Not sure" never gives a lower care level than the least worrying answer', () => {
  const r = rng(11);
  for (let i = 0; i < SAMPLES; i += 1) {
    const answers = randomAnswers(r);
    for (const q of questions) {
      const no = replace(answers, { questionId: q.questionId, type: q.type as SafetyAnswer['type'], value: scale(q.questionId)[0], state: 'answered' });
      const unsure = replace(answers, { questionId: q.questionId, type: q.type as SafetyAnswer['type'], value: null, state: 'unknown' });
      expect(rank(evaluate(unsure))).toBeGreaterThanOrEqual(rank(evaluate(no)));
    }
  }
});

test('a hard stop always wins over the points total', () => {
  const r = rng(13);
  for (let i = 0; i < SAMPLES; i += 1) {
    const out = evaluate(randomAnswers(r));
    if (out.firedRules.some((f) => f.level)) {
      expect(out.verdict).toBe('RED_FLAG');
      expect(['URGENT', 'EMERGENCY']).toContain(out.level);
    }
    if (out.firedRules.some((f) => f.level === 'EMERGENCY')) expect(out.level).toBe('EMERGENCY');
  }
});

/** A question is covered when it was answered, or every question that opens it was covered and did not open it. */
function covered(id: string, answers: Answer[]): boolean {
  const q = questions.find((x) => x.questionId === id)!;
  if (answers.some((a) => a.questionId === id && a.state === 'answered')) return true;
  if (q.required || !q.askWhen?.length) return false;
  return !isAskedQuestion(q, answers) && q.askWhen.every((c) => covered(c.questionId, answers));
}

test('every path the questionnaire can take to SAFE has covered every hard-stop question', () => {
  const r = rng(17);
  let safe = 0;
  for (let i = 0; i < SAMPLES; i += 1) {
    const answers: SafetyAnswer[] = [];
    // Answer the next asked question each time, as the questionnaire does.
    for (let step = 0; step < questions.length; step += 1) {
      const next = questions.find((q) => isAskedQuestion(q, answers) && !answers.some((a) => a.questionId === q.questionId));
      if (!next) break;
      const unknown = r() < 0.1;
      answers.push({ questionId: next.questionId, type: next.type as SafetyAnswer['type'], state: unknown ? 'unknown' : 'answered',
        value: unknown ? null : r() < 0.7 ? scale(next.questionId)[0] : pick(r, scale(next.questionId)), clarificationAttempted: unknown || undefined });
    }
    const out = evaluate(answers);
    if (out.verdict !== 'SAFE') continue;
    safe += 1;
    for (const q of questions.filter((x) => x.tier === 'hardStop')) expect(covered(q.questionId, answers)).toBe(true);
    // a denied topic gives each detail its own No
    for (const q of questions.filter((x) => x.deniedValue !== undefined && !answers.some((a) => a.questionId === x.questionId))) {
      const implied = impliedAnswer(answers, q.questionId);
      if (implied) expect(implied.value).toBe(q.deniedValue);
    }
  }
  expect(safe).toBeGreaterThan(100);
});
