// Placeholder scoring for the narrowing stub: how well each muscle matches what the patient reported.
//
//  * Only answers that are NOT unknown count. "Not sure" and "Skip" add no criterion at all, so they can never lower a
//    candidate (and never raise one). The number of unknown answers is not used anywhere.
//  * A criterion is one movement or one question. For a candidate it is "matched" when the patient reported a problem
//    (pain, weakness, could not do it, or "yes") and the criterion lists the candidate; it is "unmatched" when the
//    patient answered "no" (no problem) to a criterion that lists the candidate. Criteria that do not list the candidate
//    say nothing about it.
//  * strength = prior + (matched - w * unmatched) / fullMatchCriteria, kept between 0 and 1. It is a match score, NOT a
//    probability, and it is never shown as a number.
import { movementById, suggestsFor } from '../movement/movements';
import type { Answer } from '../gate/evaluate';
import type { MovementResult } from '../store/session';
import type { Side } from '../regions/types';
import { discriminatorIds, supportsOf } from './bank';
import { structureIds, structureMuscles } from './structureBank';
import { NARROWING } from './config';

export interface Evidence {
  /** movementId or questionId */
  id: string;
  kind: 'movement' | 'question';
  /** "yes" = a problem was reported (matches), "no" = no problem (does not match). */
  answer: 'yes' | 'no';
  /** The muscle ids this criterion is about, for the selected side. */
  supports: string[];
}

/** The criteria the patient actually answered. Unknown results and answers are left out entirely. */
export function evidenceFrom(movementResults: MovementResult[], answers: Answer[], side: Side): Evidence[] {
  const out: Evidence[] = [];
  for (const r of movementResults) {
    if (r.state === 'unknown') continue; // "Not sure" and "Skip": no criterion
    const m = movementById(r.movementId);
    if (!m) continue;
    out.push({ id: r.movementId, kind: 'movement', answer: r.painful || r.weak || r.unableToDo ? 'yes' : 'no', supports: suggestsFor(m, side) });
  }
  const ids = new Set(discriminatorIds());
  for (const a of answers) {
    if (!ids.has(a.questionId) || a.state !== 'answered') continue; // unknown: no criterion
    if (a.value !== true && a.value !== false) continue; // anything but a clear yes or no is not a criterion
    out.push({ id: a.questionId, kind: 'question', answer: a.value ? 'yes' : 'no', supports: supportsOf(a.questionId, side) });
  }
  // the structure-type questions also speak about some muscles, so the candidates move with those answers too
  const sids = new Set(structureIds());
  for (const a of answers) {
    if (!sids.has(a.questionId) || a.state !== 'answered') continue;
    if (a.value !== true && a.value !== false) continue;
    const supports = structureMuscles(a.questionId, side);
    if (supports.length > 0) out.push({ id: a.questionId, kind: 'question', answer: a.value ? 'yes' : 'no', supports });
  }
  return out;
}

export interface Scored {
  muscleId: string;
  strength: number;
  matched: string[];
  unmatched: string[];
}

export function strengthOf(matched: number, unmatched: number, prior: number): number {
  const raw = prior + (matched - NARROWING.contradictionWeight * unmatched) / NARROWING.fullMatchCriteria;
  return Math.round(Math.min(1, Math.max(0, raw)) * 100) / 100;
}

export function scoreCandidates(pool: string[], evidence: Evidence[], priorOf: (id: string) => number): Scored[] {
  return pool
    .map((muscleId) => {
      const matched = evidence.filter((e) => e.answer === 'yes' && e.supports.includes(muscleId)).map((e) => e.id);
      const unmatched = evidence.filter((e) => e.answer === 'no' && e.supports.includes(muscleId)).map((e) => e.id);
      return { muscleId, strength: strengthOf(matched.length, unmatched.length, priorOf(muscleId)), matched, unmatched };
    })
    .sort((a, b) => b.strength - a.strength || a.muscleId.localeCompare(b.muscleId));
}
