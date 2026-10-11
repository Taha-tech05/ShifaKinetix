// The red-flag questions. For now these are the PLACEHOLDER questions in shared/questions_shoulder.json (Person A
// replaces them). They are shown with the existing yes / no / not sure template and judged by the gate stub.
import questionsFile from '../../../shared/questions_shoulder.json';
import type { Question, QuestionType } from '../questions/types';

interface FileQuestion {
  questionId: string;
  text: string;
  type: string;
  isKeyDangerQuestion: boolean;
  source: string;
  label: string;
}

export function dangerQuestions(): Question[] {
  return (questionsFile.questions as FileQuestion[]).map((q) => ({
    questionId: q.questionId,
    type: q.type as QuestionType,
    text: q.text,
    isKeyDangerQuestion: q.isKeyDangerQuestion,
    source: q.source,
    label: q.label,
  }));
}

/** The key danger questions whose answer is "not sure", for the clarifying re-ask. */
export function unknownDangerQuestions(answers: { questionId: string; state: string }[]): Question[] {
  const unknown = new Set(answers.filter((a) => a.state === 'unknown').map((a) => a.questionId));
  return dangerQuestions().filter((q) => q.isKeyDangerQuestion && unknown.has(q.questionId));
}
