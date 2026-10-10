// STUB gate. Person A replaces this with the real evaluator (gate/evaluate.ts).
// Same input and output shape as evaluate(), so the swap is one import.
import type { Answer, GateOutput } from './evaluate';

/** An answer the question bank marked as a danger answer. */
export type FlaggableAnswer = Answer & { flagged?: boolean };

export function evaluateStub(answers: FlaggableAnswer[]): GateOutput {
  const firedRules: GateOutput['firedRules'] = [];
  let verdict: GateOutput['verdict'] = 'SAFE';

  for (const a of answers) {
    if (!a.flagged) continue;
    if (a.state === 'unknown') {
      // "Not sure" on a danger question must never be SAFE.
      firedRules.push({ ruleId: 'STUB_UNKNOWN', matchedAnswers: [a.questionId], source: 'stub' });
      if (verdict === 'SAFE') verdict = 'CLARIFY';
    } else {
      firedRules.push({ ruleId: 'STUB_FLAGGED', matchedAnswers: [a.questionId], source: 'stub' });
      verdict = 'RED_FLAG';
    }
  }
  return { verdict, firedRules };
}
