// Test helper: canonical safety answers for contract v2 (linked questions). Fictional values only.
import { questions } from '../../src/gate/evaluate';
import type { SafetyAnswer } from '../../src/gate/evaluate';

/** The eight always-asked questions on the low-risk path: every answer gives no sign. */
export const LOW_RISK: Record<string, SafetyAnswer['value']> = {
  chest: false, breathing: false, onset: 'gradual', unable: false,
  sensation: false, inflammation: false, illness: false, pain_score: 3,
};

/** Low-risk complete answers with changes (null = "Not sure"), in question-bank order. */
export function lowRiskAnswers(changes: Record<string, SafetyAnswer['value']> = {}, drop: string[] = []): SafetyAnswer[] {
  const values = { ...LOW_RISK, ...changes };
  return questions.filter((q) => q.questionId in values && !drop.includes(q.questionId)).map((q) => {
    const value = values[q.questionId];
    return { questionId: q.questionId, type: q.type as SafetyAnswer['type'], value, state: value === null ? 'unknown' : 'answered' };
  });
}
