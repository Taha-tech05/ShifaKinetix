import type { Answer } from '../gate/evaluate';

export type { Answer };

export type QuestionType =
  | 'yesno'
  | 'chooseone'
  | 'chooseseveral'
  | 'scale0to10'
  | 'duration'
  | 'cancant';

export interface QuestionOption {
  id: string;
  label: string;
}

export interface Question {
  questionId: string;
  type: QuestionType;
  text: string;
  options?: QuestionOption[];
  isKeyDangerQuestion?: boolean;
  /** Where the question comes from, e.g. "PLACEHOLDER, Person C replaces". */
  source?: string;
  /** Review status, e.g. "draft, awaiting clinician review". */
  label?: string;
}

export type DurationUnit = 'days' | 'weeks' | 'months';

export interface DurationValue {
  amount: number;
  unit: DurationUnit;
}

/** The shape every question template reports: shared format 1, plus an optional danger flag for the gate stub. */
export type QuestionResult = Answer & { flagged?: boolean };

export interface TemplateProps {
  question: Question;
  onAnswer: (result: QuestionResult) => void;
}
