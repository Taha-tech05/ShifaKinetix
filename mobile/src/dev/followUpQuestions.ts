// PLACEHOLDER, Person C replaces. Loads the fixed follow-up questions from followUpQuestionsStub.json.
// Every question here is draft, awaiting clinician review.
import { getLanguage } from '../i18n';
import type { Language } from '../i18n';
import type { Answer, Question, QuestionType } from '../questions/types';
import stub from './followUpQuestionsStub.json';

type Localized = { en: string; ur: string; roman: string };
interface StubQuestion {
  questionId: string;
  type: string;
  text: Localized;
  options?: { id: string; label: Localized }[];
  source: string;
}

export const DEPTH_QUESTION_ID = 'Q_DEPTH_PLACEHOLDER';
export const DEPTH_OPTION_UNDER_SKIN = 'just_under_skin';
export const DEPTH_OPTION_DEEP = 'deep_inside';

/** Answer to the depth question. null (not asked yet) is different from "unknown" (the patient said not sure). */
export interface DepthAnswer {
  state: 'answered' | 'unknown';
  /** null when state is "unknown". "Not sure" is never turned into one of the other answers. */
  value: 'just_under_skin' | 'deep_inside' | null;
}

const pick = (l: Localized, lang: Language) => l[lang] ?? l.en;

/** The fixed follow-up questions, in the current language. */
export function followUpQuestions(lang: Language = getLanguage()): Question[] {
  return (stub.questions as StubQuestion[]).map((q) => ({
    questionId: q.questionId,
    type: q.type as QuestionType,
    text: pick(q.text, lang),
    options: q.options?.map((o) => ({ id: o.id, label: pick(o.label, lang) })),
    source: q.source,
    label: stub.review,
  }));
}

export function depthQuestion(lang: Language = getLanguage()): Question {
  return followUpQuestions(lang).find((q) => q.questionId === DEPTH_QUESTION_ID) as Question;
}

/** The depth answer for the narrowing step, or null if the question was not asked yet. */
export function depthAnswerFrom(answers: Answer[]): DepthAnswer | null {
  const a = answers.find((x) => x.questionId === DEPTH_QUESTION_ID);
  if (!a) return null;
  if (a.state === 'unknown') return { state: 'unknown', value: null };
  if (a.value === DEPTH_OPTION_UNDER_SKIN || a.value === DEPTH_OPTION_DEEP) return { state: 'answered', value: a.value };
  // An answered value we do not recognise must not become one of the known answers.
  return { state: 'unknown', value: null };
}
