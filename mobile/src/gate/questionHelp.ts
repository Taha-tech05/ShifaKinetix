// UI explanations of the existing sourced questions, not additional clinical rules.
// Draft, awaiting clinician review. Sources are displayed from the question bank.
import type { Answer, Question } from './evaluate';
import { prefillValue } from './sessionAdapter';

export const questionHelp: Record<string, string> = {
  onset: 'Choose the closest option. An injury means something like a fall, a knock or a sudden strain.',
  unable: 'This asks whether the arm cannot move at all, not whether moving it hurts. Do not try a painful movement to answer.',
  sensation: 'Choose Yes if any of these apply, and we will ask about each one. Choose No if none apply.',
  numb: 'This is about losing feeling, not weakness or tiredness. Do not test yourself.',
  tingling: 'Pins and needles that keep going or never fully settle count as not going away.',
  inflammation: 'Choose Yes if any of these apply, and we will ask about each one. Choose No if none apply.',
  illness: 'Choose Yes if any of these apply, and we will ask about each one. Choose No if none apply.',
  swelling: 'Compare with your other shoulder.',
  temperature: 'Compare with your other arm.',
};

/** Wording for a follow-up: it refers to the earlier answer, so it reads as a check, not as the same question again. */
export interface FollowUpPrompt {
  text: string;
  /** Answer chips for a yes/no follow-up, in place of plain Yes and No. */
  choices?: { label: string; value: boolean }[];
}

export function followUpPrompt(question: Question, input: readonly Answer[]): FollowUpPrompt {
  if (question.questionId === 'unable') {
    return {
      text: 'During the movement checks you could not do one of the movements. Earlier you said you can move this arm. Which is closer?',
      choices: [
        { label: 'It moves, but it is painful or limited', value: false },
        { label: 'I really cannot lift or move it', value: true },
      ],
    };
  }
  const earlier = prefillValue(input, question);
  if (question.questionId === 'onset') {
    const label = question.options?.find((o) => o.value === earlier)?.label.toLowerCase();
    return { text: `In your first answers you said the pain started ${label ?? 'differently'}. Which is right?` };
  }
  if (question.questionId === 'pain_score') {
    return { text: `In your first answers your pain score was ${String(earlier ?? 'different')}. What is it right now?` };
  }
  return { text: `One of your earlier answers changed. ${question.wording}` };
}
