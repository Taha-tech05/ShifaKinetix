// Scoring of the structure type (muscle or tendon, joint or capsule, bone, nerve or neck) from the fixed questions.
//
//  * Only answered yes / no count. "Not sure" and "Skip" (state unknown) add nothing: a category's score never goes down because
//    an answer is unknown, and the number of unknown answers is not used anywhere.
//  * Each answer adds the signed weight of the expected-response table to each category (a "no" can also support a category,
//    for example no tingling supports muscle or tendon). The score is the sum divided by STRUCTURE.fullScore, kept between 0
//    and 1. It is a match score, NOT a probability, and is never shown as a number.
//  * The categories are "separated" when the leader has at least STRUCTURE.minLeaderScore and is ahead of the next by
//    STRUCTURE.leadMargin, after at least STRUCTURE.minNonUnknownAnswers answers that are not unknown.
import type { Answer } from '../gate/evaluate';
import { CATEGORIES, expectedResponse, structureIds } from './structureBank';
import type { Category } from './structureBank';
import { bandOf, STRUCTURE } from './config';
import type { Band } from './config';

export interface CategoryScore {
  category: Category;
  /** 0 to 1, for the match bar only. Not a probability. */
  strength: number;
  band: Band;
  /** Ids of the questions whose answer supported (matched) or went against (unmatched) this category. */
  matched: string[];
  unmatched: string[];
}

export interface StructureState {
  asked: number;
  nonUnknown: number;
  /** "narrowing" (too few answers), "continue", "separated" (a leader), "capped" (cap reached, no leader). */
  status: 'narrowing' | 'continue' | 'separated' | 'capped';
  leader: Category | null;
  /** All four categories, strongest first. Empty while status is "narrowing". */
  scores: CategoryScore[];
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function structureCounts(answers: Answer[]): { asked: number; nonUnknown: number } {
  const ids = new Set(structureIds());
  const mine = answers.filter((a) => ids.has(a.questionId));
  return { asked: mine.length, nonUnknown: mine.filter((a) => a.state === 'answered' && (a.value === true || a.value === false)).length };
}

/** Scores of all four categories from the answers (unknown ones ignored). Always computed, strongest first. */
export function categoryScores(answers: Answer[]): CategoryScore[] {
  const ids = new Set(structureIds());
  const sums = new Map<Category, { sum: number; matched: string[]; unmatched: string[] }>(CATEGORIES.map((c) => [c, { sum: 0, matched: [], unmatched: [] }]));
  for (const a of answers) {
    if (!ids.has(a.questionId) || a.state !== 'answered') continue; // unknown: nothing
    if (a.value !== true && a.value !== false) continue;
    const table = expectedResponse(a.questionId);
    if (!table) continue;
    const w = a.value ? table.yes : table.no;
    for (const c of CATEGORIES) {
      const x = w[c];
      if (!x) continue;
      const e = sums.get(c)!;
      e.sum += x;
      (x > 0 ? e.matched : e.unmatched).push(a.questionId);
    }
  }
  return CATEGORIES.map((category) => {
    const e = sums.get(category)!;
    const strength = round2(Math.min(1, Math.max(0, e.sum / STRUCTURE.fullScore)));
    return { category, strength, band: bandOf(strength), matched: e.matched, unmatched: e.unmatched };
  }).sort((a, b) => b.strength - a.strength || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));
}

/** The status of the structure step from category scores (strongest first) and the counts of asked and answered questions. */
export function decideStructure(scores: CategoryScore[], asked: number, nonUnknown: number): StructureState {
  const capped = asked >= STRUCTURE.maxQuestions;
  if (nonUnknown < STRUCTURE.minNonUnknownAnswers || scores.length === 0) return { asked, nonUnknown, status: capped ? 'capped' : 'narrowing', leader: null, scores: [] };
  const [top, next] = scores;
  const separated = top.strength >= STRUCTURE.minLeaderScore && top.strength - (next?.strength ?? 0) >= STRUCTURE.leadMargin;
  if (separated) return { asked, nonUnknown, status: 'separated', leader: top.category, scores };
  return { asked, nonUnknown, status: capped ? 'capped' : 'continue', leader: null, scores };
}

export function structureState(answers: Answer[]): StructureState {
  const { asked, nonUnknown } = structureCounts(answers);
  return decideStructure(categoryScores(answers), asked, nonUnknown);
}
