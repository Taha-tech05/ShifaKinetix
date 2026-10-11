// The live narrowing state after every answer: what the strip under the model shows, whether to keep asking, and when to
// stop ("Thanks, that's enough to go on"). Pure functions over the narrowing interface (dev/narrowingStub.ts narrow()).
//
//  * Before at least NARROWING.minNonUnknownAnswers answers that are not unknown, there is NO list: status "narrowing".
//  * The flow stops early when the top candidate leads the next one by NARROWING.leadMargin with at least
//    NARROWING.minMatchedCriteria matched criteria (status "enough"), or when NARROWING.maxQuestions have been asked
//    (status "capped"). If the candidates are not separated at the cap they are shown as ONE cluster, not as one muscle.
//  * Candidates carry a band (low, moderate, higher) and a strength between 0 and 1 for the match bar. The strength is a
//    match score, not a probability; no screen prints it as a number.
//  * Skips and "Not sure" count as asked (towards the cap) but never as an answer: they do not lower any candidate.
import { narrow } from '../dev/narrowingStub';
import type { NarrowingInput } from '../dev/narrowingStub';
import { isDiscriminator } from './bank';
import { decideStructure, structureCounts } from './structureType';
import type { CategoryScore, StructureState } from './structureType';
import type { CategoryOrUnclear } from './structureBank';
import { bandOf, NARROWING } from './config';
import type { Band } from './config';

export type LiveStatus = 'narrowing' | 'continue' | 'enough' | 'capped';

export interface LiveCandidate {
  muscleId: string;
  /** 0 to 1, for the match bar only. Not a probability. */
  strength: number;
  band: Band;
  reason: string;
  /** Ids of the movements and questions that matched, and that did not (answered "no"). */
  matched: string[];
  unmatched: string[];
}

/** The structure types as the strip and the result show them. */
export type LiveCategory = CategoryScore;

export interface LiveStructure {
  /** Structure-type questions asked so far (answered or skipped) and how many were answered. */
  asked: number;
  nonUnknown: number;
  status: StructureState['status'];
  leader: StructureState['leader'];
  /** Empty while status is "narrowing". Strongest first. */
  categories: LiveCategory[];
}

export interface LiveState {
  /** Movements and discriminator questions asked so far, answered or skipped. */
  asked: number;
  /** Of those, how many were answered (not "unknown"). */
  nonUnknown: number;
  status: LiveStatus;
  /** Empty while status is "narrowing". */
  candidates: LiveCandidate[];
  /** True when the shown candidates are not separated and are presented together as one cluster. */
  cluster: boolean;
  /** True when the flow should stop asking ("enough" or "capped"). */
  stop: boolean;
  /** The structure-type step, which runs before the muscles. */
  structure: LiveStructure;
  /** True when MUSCLE_TENDON leads the other categories by the margin, so muscles may be shown. */
  muscleAllowed: boolean;
  /** "pending" (still deciding the type), "muscle" (muscles may be shown) or "category" (the result is a structure type). */
  outcome: 'pending' | 'muscle' | 'category';
  /** The category result when outcome is "category" (UNCLEAR when no category stands out). */
  categoryResult: CategoryOrUnclear | null;
}

/** How many questions were asked, and how many of those were answered, from the narrowing input. */
export function counts(input: Pick<NarrowingInput, 'movementResults' | 'answers'>): { asked: number; nonUnknown: number } {
  const qs = (input.answers ?? []).filter((a) => isDiscriminator(a.questionId));
  return {
    asked: input.movementResults.length + qs.length,
    nonUnknown: input.movementResults.filter((m) => m.state !== 'unknown').length + qs.filter((a) => a.state === 'answered').length,
  };
}

export function evaluateLive(input: NarrowingInput): LiveState {
  // The narrowing interface is called after every answer, skips included. What may be shown is decided below.
  const out = narrow(input);
  const { asked, nonUnknown } = counts(input);
  const sc = structureCounts(input.answers ?? []);
  const cats: CategoryScore[] = out.candidates
    .filter((c) => c.kind === 'category')
    .map((c) => ({ category: c.muscleId as CategoryScore['category'], strength: c.confidence, band: bandOf(c.confidence), matched: c.matched ?? [], unmatched: c.unmatched ?? [] }));
  const st = decideStructure(cats, sc.asked, sc.nonUnknown);
  const structure: LiveStructure = { asked: st.asked, nonUnknown: st.nonUnknown, status: st.status, leader: st.leader, categories: st.scores };
  // A narrowing without structure types (a replacement that does not know them) leaves the muscle flow as it was.
  const available = cats.length > 0;
  const base = { structure, muscleAllowed: false, outcome: 'pending' as const, categoryResult: null as CategoryOrUnclear | null };

  if (available) {
    if (st.status === 'separated' && st.leader !== 'MUSCLE_TENDON') {
      return { asked, nonUnknown, status: 'continue', candidates: [], cluster: false, stop: true, ...base, outcome: 'category', categoryResult: st.leader };
    }
    if (st.status === 'capped') {
      return { asked, nonUnknown, status: 'continue', candidates: [], cluster: false, stop: true, ...base, outcome: 'category', categoryResult: 'UNCLEAR' };
    }
    if (st.status !== 'separated') {
      return { asked, nonUnknown, status: 'narrowing', candidates: [], cluster: false, stop: false, ...base };
    }
  }

  // muscle or tendon leads (or there is no structure step): rank the muscles as before
  const capped = asked >= NARROWING.maxQuestions;
  const m = { ...base, muscleAllowed: true, outcome: 'muscle' as const };
  if (nonUnknown < NARROWING.minNonUnknownAnswers) {
    return { asked, nonUnknown, status: capped ? 'capped' : 'narrowing', candidates: [], cluster: false, stop: capped, ...m };
  }
  const all: LiveCandidate[] = out.candidates
    .filter((c) => c.kind !== 'category')
    .map((c) => ({
      muscleId: c.muscleId,
      strength: c.confidence,
      band: bandOf(c.confidence),
      reason: c.reason,
      matched: c.matched ?? [],
      unmatched: c.unmatched ?? [],
    }));
  const withEvidence = all.filter((c) => c.matched.length > 0);
  const top = withEvidence[0];
  if (!top) return { asked, nonUnknown, status: capped ? 'capped' : 'continue', candidates: [], cluster: false, stop: capped, ...m };

  const next = withEvidence[1];
  const lead = top.strength - (next ? next.strength : 0);
  const separated = lead >= NARROWING.leadMargin && top.matched.length >= NARROWING.minMatchedCriteria;
  if (separated) return { asked, nonUnknown, status: 'enough', candidates: [top], cluster: false, stop: true, ...m };

  // not separated: the candidates within the margin of the top one belong together
  const together = withEvidence.filter((c) => top.strength - c.strength < NARROWING.leadMargin).slice(0, NARROWING.maxCandidatesShown);
  return { asked, nonUnknown, status: capped ? 'capped' : 'continue', candidates: together, cluster: together.length > 1, stop: capped, ...m };
}

/** What is stored for the doctor view after each answer: how the ranking evolved. */
export interface NarrowingSnapshot {
  /** 1-based number of the step (movements and questions asked so far). */
  step: number;
  /** The movement or question just answered or skipped, and what the answer was ("yes", "no", "unknown", "pain", ...). */
  afterId: string;
  answer: string;
  state: LiveState;
  gateVerdict: string | null;
  at: string;
}

export function snapshotOf(afterId: string, answer: string, state: LiveState, gateVerdict: string | null, now: Date = new Date()): NarrowingSnapshot {
  return { step: state.asked + state.structure.asked, afterId, answer, state, gateVerdict, at: now.toISOString() };
}
