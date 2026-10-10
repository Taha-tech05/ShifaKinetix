import type { Question, QuestionResult } from './types';

/**
 * Build an answered result. `flagged` marks a "yes" on a key danger question
 * for the gate stub; the real gate ignores it.
 */
export function answered(question: Question, value: unknown): QuestionResult {
  const result: QuestionResult = {
    questionId: question.questionId,
    type: question.type,
    value,
    state: 'answered',
  };
  if (question.isKeyDangerQuestion && value === true) result.flagged = true;
  return result;
}

/**
 * "Not sure". Always state "unknown" with a null value. It is never turned
 * into No, zero, or any other answered value.
 */
export function unknown(question: Question): QuestionResult {
  const result: QuestionResult = {
    questionId: question.questionId,
    type: question.type,
    value: null,
    state: 'unknown',
  };
  if (question.isKeyDangerQuestion) result.flagged = true;
  return result;
}
