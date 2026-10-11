// The fixed bank of discriminator questions (shared/narrowing_bank_shoulder.json). One idea per question, one structured
// answer each. Placeholder content, awaiting clinician review. No LLM is involved: the questions are fixed.
import { getLanguage } from '../i18n';
import type { Language } from '../i18n';
import type { Question } from '../questions/types';
import type { Side } from '../regions/types';
import bank from '../../../shared/narrowing_bank_shoulder.json';

type Localized = { en: string; ur: string; roman: string };
interface BankQuestion {
  questionId: string;
  order: number;
  type: string;
  text: Localized;
  supports: string[];
  why: Localized;
  source: string;
  label: string;
}

export const BANK_LABEL: string = bank.label;
const QUESTIONS = (bank.questions as BankQuestion[]).slice().sort((a, b) => a.order - b.order);
const pick = (l: Localized, lang: Language) => l[lang] ?? l.en;

/** The structure ids of a question for a side: the data names the right-side muscles, the left side uses the matching ones. */
export const forSide = (ids: string[], side: Side): string[] => (side === 'right' ? ids : ids.map((id) => id.replace(/_right$/, '_left')));

export function discriminatorIds(): string[] {
  return QUESTIONS.map((q) => q.questionId);
}

export function isDiscriminator(questionId: string): boolean {
  return QUESTIONS.some((q) => q.questionId === questionId);
}

/** The questions as the app's Question objects, in order, in the current language. */
export function discriminatorQuestions(lang: Language = getLanguage()): Question[] {
  return QUESTIONS.map((q) => ({ questionId: q.questionId, type: 'yesno', text: pick(q.text, lang), source: q.source, label: q.label }));
}

export function supportsOf(questionId: string, side: Side): string[] {
  const q = QUESTIONS.find((x) => x.questionId === questionId);
  return q ? forSide(q.supports, side) : [];
}

export function questionText(questionId: string, lang: Language = getLanguage()): string | null {
  const q = QUESTIONS.find((x) => x.questionId === questionId);
  return q ? pick(q.text, lang) : null;
}

export function questionWhy(questionId: string, lang: Language = getLanguage()): string | null {
  const q = QUESTIONS.find((x) => x.questionId === questionId);
  return q ? pick(q.why, lang) : null;
}

/** A question with one idea has no "or" / "and" joining two things to answer yes or no to. */
export function looksDoubleBarrelled(text: string): boolean {
  return /\b(or|and)\b/i.test(text);
}
