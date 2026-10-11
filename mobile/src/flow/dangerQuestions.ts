import { questions } from '../gate/evaluate';
import type { Question } from '../questions/types';

/** Presentation adapter; the safety screens preserve canonical types and values. */
export function dangerQuestions(): Question[] {
  return questions.map((q) => ({
    questionId: q.questionId,
    type: q.type === 'choice' ? 'chooseone' : q.type === 'number' ? 'scale0to10' : q.type as 'yesno' | 'duration',
    text: q.wording, isKeyDangerQuestion: q.required,
    options: q.options?.map((o) => ({ id: o.value, label: o.label })),
    source: q.source, label: q.label,
  }));
}
export function unknownDangerQuestions(answers: { questionId: string; state: string }[]): Question[] {
  const unknown = new Set(answers.filter((a) => a.state === 'unknown').map((a) => a.questionId));
  return dangerQuestions().filter((q) => q.isKeyDangerQuestion && unknown.has(q.questionId));
}
