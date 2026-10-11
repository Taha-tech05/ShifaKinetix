// The fixed structure-type questions (shared/structure_type_bank_shoulder.json): is the pain from a muscle or tendon, a joint or
// capsule, a bone, or a nerve or the neck? One idea per question, one structured answer each (yes / no / unknown).
// Placeholder content, awaiting clinician review. No LLM: the questions and the expected-response table are fixed.
import { getLanguage } from '../i18n';
import type { Language } from '../i18n';
import type { Question } from '../questions/types';
import bank from '../../../shared/structure_type_bank_shoulder.json';

export type Category = 'MUSCLE_TENDON' | 'JOINT_CAPSULE' | 'BONE' | 'NERVE_NECK';
export type CategoryOrUnclear = Category | 'UNCLEAR';
export const CATEGORIES: Category[] = ['MUSCLE_TENDON', 'JOINT_CAPSULE', 'BONE', 'NERVE_NECK'];

type Localized = { en: string; ur: string; roman: string };
type Weights = Partial<Record<Category, number>>;
interface BankQuestion {
  questionId: string;
  order: number;
  type: string;
  text: Localized;
  yes: Weights;
  no: Weights;
  source: string;
  label: string;
}

export const STRUCTURE_BANK_LABEL: string = bank.label;
const QUESTIONS = (bank.questions as unknown as BankQuestion[]).slice().sort((a, b) => a.order - b.order);
const pick = (l: Localized, lang: Language) => l[lang] ?? l.en;

export const BONE_POINT_ID = 'Q_ST_BONE_POINT';
export const TINGLE_ID = 'Q_ST_TINGLE';
export const NUMB_ID = 'Q_ST_NUMB';

export function structureIds(): string[] {
  return QUESTIONS.map((q) => q.questionId);
}

export function isStructureQuestion(questionId: string): boolean {
  return QUESTIONS.some((q) => q.questionId === questionId);
}

export function structureQuestions(lang: Language = getLanguage()): Question[] {
  return QUESTIONS.map((q) => ({ questionId: q.questionId, type: 'yesno', text: pick(q.text, lang), source: q.source, label: q.label }));
}

/** The expected-response table: what a yes and a no mean for each category (signed weights). */
export function expectedResponse(questionId: string): { yes: Weights; no: Weights } | null {
  const q = QUESTIONS.find((x) => x.questionId === questionId);
  return q ? { yes: q.yes, no: q.no } : null;
}

export function structureQuestionText(questionId: string, lang: Language = getLanguage()): string | null {
  const q = QUESTIONS.find((x) => x.questionId === questionId);
  return q ? pick(q.text, lang) : null;
}

export function categoryName(c: CategoryOrUnclear, lang: Language = getLanguage()): string {
  const names = bank.categories as unknown as Record<string, Localized>;
  return pick(names[c], lang);
}
