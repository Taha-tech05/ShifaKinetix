// PLACEHOLDER follow-up questions. Person C replaces this file with the real question flow.
// Every question here is draft, awaiting clinician review.
import { t } from '../i18n';
import type { DepthAnswer } from '../narrowing/stub';
import type { Answer, Question } from './types';

export const DEPTH_QUESTION_ID = 'Q_DEPTH_PLACEHOLDER';

export const DEPTH_OPTION_UNDER_SKIN = 'just_under_skin';
export const DEPTH_OPTION_DEEP = 'deep_inside';

/**
 * The fixed depth question that replaces the old Surface / Middle / Deep picker on P6.
 * "Not sure" is the built-in button of the choose-one template and is stored as state "unknown".
 */
export function depthQuestion(): Question {
  return {
    questionId: DEPTH_QUESTION_ID,
    type: 'chooseone',
    text: t('followUp.depthQuestion'),
    options: [
      { id: DEPTH_OPTION_UNDER_SKIN, label: t('followUp.underSkin') },
      { id: DEPTH_OPTION_DEEP, label: t('followUp.deepInside') },
    ],
    source: 'PLACEHOLDER, Person C replaces',
    label: 'draft, awaiting clinician review',
  };
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
