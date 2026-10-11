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
import { discriminatorIds, isDiscriminator } from './bank';
import { decideStructure, structureCounts } from './structureType';
import type { CategoryScore, StructureState } from './structureType';
import type { CategoryOrUnclear } from './structureBank';
import { bandOf, NARROWING, STRUCTURE } from './config';
import { MOVEMENTS } from '../movement/movements';
import type { IntakeMode } from '../regions/regionMap';
import { structureIds } from './structureBank';
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
  /**
   * The muscles shown on the model: up to 3, "possible so far". They exist from the first screen (seeded from the tapped area)
   * and are updated after every answer, skips included. They are provisional until the question set is finished. Empty
   * only when the finished result is not a muscle result.
   */
  candidates: LiveCandidate[];
  /** True when the shown candidates are not separated by the margin and are presented together as one cluster. */
  cluster: boolean;
  /** True when the flow should stop asking: the question set is finished, or a muscle-leading result is clear enough. */
  stop: boolean;
  /** The structure-type step. It runs silently while the questions are asked; nothing is concluded from it before the end. */
  structure: LiveStructure;
  /** True when MUSCLE_TENDON leads the other categories by the margin (the muscle-leading path). */
  muscleAllowed: boolean;
  /** True until the question set is finished: the candidates are "possible so far", not a conclusion. */
  provisional: boolean;
  /** Answers that are not unknown, over movements and all questions. Bands show from NARROWING.minAnswersForBands. */
  totalNonUnknown: number;
  bandsVisible: boolean;
  /** "pending" while asking, "muscle" for a finished muscle-leading result, "category" for a finished non-muscle result. */
  outcome: 'pending' | 'muscle' | 'category';
  /** The category result, only when outcome is "category" (UNCLEAR when no category stands out). */
  categoryResult: CategoryOrUnclear | null;
}

/** How many questions were asked, and how many of those were answered, from the narrowing input (movements and muscle questions). */
export function counts(input: Pick<NarrowingInput, 'movementResults' | 'answers'>): { asked: number; nonUnknown: number } {
  const qs = (input.answers ?? []).filter((a) => isDiscriminator(a.questionId));
  return {
    asked: input.movementResults.length + qs.length,
    nonUnknown: input.movementResults.filter((m) => m.state !== 'unknown').length + qs.filter((a) => a.state === 'answered').length,
  };
}

const toCandidate = (c: { muscleId: string; confidence: number; reason: string; matched?: string[]; unmatched?: string[] }): LiveCandidate => ({
  muscleId: c.muscleId,
  strength: c.confidence,
  band: bandOf(c.confidence),
  reason: c.reason,
  matched: c.matched ?? [],
  unmatched: c.unmatched ?? [],
});

/** How many movement steps the mode has (guided movements only exist in region mode). */
const movementCount = (mode: IntakeMode) => (mode === 'region' ? MOVEMENTS.length : 0);

/** How many questions and movements the muscle path asks at most (movements plus muscle questions, within the cap). */
export function muscleStepCount(mode: IntakeMode): number {
  return Math.min(NARROWING.maxQuestions, movementCount(mode) + discriminatorIds().length);
}

/** How many structure-type questions the step asks at most. */
export function structureStepCount(): number {
  return Math.min(STRUCTURE.maxQuestions, structureIds().length);
}

/**
 * The live state after an answer, computed from scratch from ALL the current answers (so going back and changing an answer
 * gives exactly what a fresh run with the same answers gives).
 *
 *  - Muscles: shown from the first screen, up to 3, provisional until the question set is finished. They never wait for a
 *    structure category to win. Unknown answers add nothing. Bands appear after NARROWING.minAnswersForBands real answers.
 *  - Structure type: scored silently while asking. A non-muscle or unclear conclusion is drawn only when every structure
 *    question has been answered or skipped, never earlier. A muscle-leading result may stop early on the margin.
 */
export function evaluateLive(input: NarrowingInput, mode: IntakeMode = 'region'): LiveState {
  // The narrowing interface is called after every answer, skips included.
  const out = narrow(input);
  const { asked, nonUnknown } = counts(input);
  const sc = structureCounts(input.answers ?? []);
  const cats: CategoryScore[] = out.candidates
    .filter((c) => c.kind === 'category')
    .map((c) => ({ category: c.muscleId as CategoryScore['category'], strength: c.confidence, band: bandOf(c.confidence), matched: c.matched ?? [], unmatched: c.unmatched ?? [] }));
  const st = decideStructure(cats, sc.asked, sc.nonUnknown);
  const structure: LiveStructure = { asked: st.asked, nonUnknown: st.nonUnknown, status: st.status, leader: st.leader, categories: st.scores };
  // A narrowing without structure types (a replacement that does not know them) keeps the plain muscle flow.
  const available = cats.length > 0;
  const muscleLeads = !available || (st.status === 'separated' && st.leader === 'MUSCLE_TENDON');
  const totalNonUnknown = nonUnknown + sc.nonUnknown;
  const bandsVisible = totalNonUnknown >= NARROWING.minAnswersForBands;

  // the muscles: seeded from the tapped area, ranked by the answers; all of them, shown up to 3
  const all = out.candidates.filter((c) => c.kind !== 'category').map(toCandidate);
  const top = all[0];
  const next = all[1];
  const lead = top ? top.strength - (next ? next.strength : 0) : 0;
  const separated = !!top && lead >= NARROWING.leadMargin && top.matched.length >= NARROWING.minMatchedCriteria;
  const shown = !top ? [] : separated ? [top] : all.filter((c) => top.strength - c.strength < NARROWING.leadMargin).slice(0, NARROWING.maxCandidatesShown);

  // is the question set finished?
  const muscleCapped = asked >= muscleStepCount(mode);
  const structureComplete = sc.asked >= structureStepCount();
  const muscleEarlyStop = muscleLeads && separated && bandsVisible && st.status === 'separated';
  const finished = muscleLeads ? muscleCapped || muscleEarlyStop || (!available && separated) : structureComplete;
  const concludedNonMuscle = finished && !muscleLeads;

  const base = { asked, nonUnknown, structure, muscleAllowed: muscleLeads, totalNonUnknown, bandsVisible, provisional: !finished };
  if (concludedNonMuscle) {
    const leader = st.status === 'separated' ? st.leader : null;
    return { ...base, status: 'continue', candidates: [], cluster: false, stop: true, outcome: 'category', categoryResult: leader ?? 'UNCLEAR' };
  }
  const status: LiveStatus = finished ? (muscleEarlyStop ? 'enough' : 'capped') : bandsVisible ? 'continue' : 'narrowing';
  return { ...base, status, candidates: shown, cluster: shown.length > 1, stop: finished, outcome: finished ? 'muscle' : 'pending', categoryResult: null };
}

/** What is stored for the doctor view after each answer: how the ranking evolved. */
export interface NarrowingSnapshot {
  /** The history entry (seq) this snapshot belongs to; missing for a snapshot made by going back. */
  seq?: number;
  /** Set when the answer behind this snapshot was changed or undone; the snapshot stays in the log. */
  supersededAt?: string;
  /** True for a snapshot made by recomputing everything after going back. */
  recomputed?: boolean;
  /** 1-based number of the step (movements and questions asked so far). */
  step: number;
  /** The movement or question just answered or skipped, and what the answer was ("yes", "no", "unknown", "pain", ...). */
  afterId: string;
  answer: string;
  state: LiveState;
  gateVerdict: string | null;
  at: string;
}

export function snapshotOf(afterId: string, answer: string, state: LiveState, gateVerdict: string | null, now: Date = new Date(), extra: { seq?: number; recomputed?: boolean } = {}): NarrowingSnapshot {
  return { step: state.asked + state.structure.asked, afterId, answer, state, gateVerdict, at: now.toISOString(), ...extra };
}
