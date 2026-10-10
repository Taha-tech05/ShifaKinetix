import { Answer, evaluate, questions } from '../src/gate/evaluate';
import rules from '../../shared/gate_rules.json';
import sources from '../../shared/clinical_sources.json';

const baseline = (): Answer[] => questions.filter((q) => q.required).map((q) => ({
  questionId: q.questionId, type: q.type as Answer['type'],
  value: q.type === 'choice' ? 'normal' : false, state: 'answered',
}));

test('every rule has traceable clauses, source provenance and draft label', () => {
  expect(questions).toHaveLength(20);
  expect(new Set(questions.map((q) => q.questionId)).size).toBe(questions.length);
  expect(new Set(rules.rules.map((r) => r.ruleId)).size).toBe(rules.rules.length);
  for (const item of [...questions, ...rules.rules]) {
    expect(item.label).toBe('draft, awaiting clinician review');
    expect(sources.sources.some((s) => s.url === item.source && !s.use.startsWith('Pending'))).toBe(true);
  }
  for (const rule of rules.rules) for (const clause of rule.all) {
    expect(questions.some((q) => q.questionId === clause.questionId)).toBe(true);
  }
});

test.each(questions.filter((q) => q.required))('missing or unresolved $questionId cannot be SAFE', (q) => {
  const answers = baseline().filter((a) => a.questionId !== q.questionId);
  expect(evaluate(answers).verdict).toBe('CLARIFY');
  answers.push({ questionId: q.questionId, type: q.type as Answer['type'], value: null, state: 'unknown' });
  expect(evaluate(answers).verdict).toBe('CLARIFY');
  answers[answers.length - 1].clarificationAttempted = true;
  expect(evaluate(answers).verdict).toBe('RED_FLAG');
});

test('changing answer order never changes a result', () => {
  const answers = baseline();
  answers[0].value = true;
  expect(evaluate([...answers].reverse())).toEqual(evaluate(answers));
});

test.each([NaN, Infinity, -1, 11])('invalid numeric value %s fails closed', (value) => {
  expect(evaluate([...baseline(), { questionId: 'pain_score', type: 'number', state: 'answered', value }]).verdict)
    .toBe('RED_FLAG');
});

test('does not mutate supplied answers', () => {
  const answers = baseline().map((a) => Object.freeze(a));
  expect(evaluate(Object.freeze(answers)).verdict).toBe('SAFE');
});
