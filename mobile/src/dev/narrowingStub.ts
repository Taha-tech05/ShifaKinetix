// PLACEHOLDER, Person C replaces. Dummy narrowing so the live flow and the result screen can be built.
// It makes NO clinical claim beyond "may be involved". It scores the muscles of the selected side by how well they match
// the answers (src/narrowing/scoring.ts) with placeholder expectations (shared/narrowing_bank_shoulder.json and the
// movement data), all draft, awaiting clinician review.
// To replace it, change the body of narrow() (or the import in flow/intake.ts). The function and its types are the
// agreed interface; the two OPTIONAL additions below (input.answers, candidate.matched / unmatched) can be ignored by a
// replacement: nothing breaks without them, the screens then just show less "why" text.
// Output shape is the agreed one: {candidates: [{muscleId, confidence, reason}], cluster} (shared/formats.md, format 4).
import { NARROWING } from '../narrowing/config';
import { evidenceFrom, scoreCandidates } from '../narrowing/scoring';
import { categoryScores } from '../narrowing/structureType';
import { REGION_MAP, structuresIn } from '../regions/regionMap';
import type { Answer } from '../gate/evaluate';
import type { BodyLayer, Point3D, Side, SubRegionId } from '../regions/types';
import type { MovementResult } from '../store/session';
import type { DepthAnswer } from './followUpQuestions';

export type { DepthAnswer } from './followUpQuestions';

export interface NarrowingInput {
  /** The layer the patient tapped in: "muscle" or "bone". */
  layer: BodyLayer;
  /** Side-level region, "shoulder_right" or "shoulder_left". */
  regionId: string;
  subRegionId: SubRegionId;
  point: Point3D;
  /** Mesh name of the closest structure in exact mode (a hint only), else null. */
  hitMeshName: string | null;
  depthAnswer: DepthAnswer | null;
  movementResults: MovementResult[];
  /**
   * OPTIONAL. The patient's answers (shared format 1), for the discriminator questions. Answers with state "unknown"
   * ("Not sure", "Skip") must never be treated as "no". A replacement may ignore this field.
   */
  answers?: Answer[];
}

export interface Candidate {
  /**
   * OPTIONAL. "muscle" (or missing): a muscle, muscleId is a structure id in shared/regions_shoulder.json.
   * "category": a structure type (MUSCLE_TENDON, JOINT_CAPSULE, BONE, NERVE_NECK), muscleId is the category id.
   */
  kind?: 'muscle' | 'category';
  /** Id of a structure in shared/regions_shoulder.json, or of a structure category when kind is "category". */
  muscleId: string;
  /** Match strength from 0 to 1. NOT a probability; the screens show a band, never this number. */
  confidence: number;
  reason: string;
  /** OPTIONAL. Ids of the movements and questions that matched this muscle (for the "why" text). */
  matched?: string[];
  /** OPTIONAL. Ids of the movements and questions answered "no" that this muscle would have expected a "yes" for. */
  unmatched?: string[];
}

export interface NarrowingOutput {
  candidates: Candidate[];
  cluster: boolean;
  /** OPTIONAL. True while the question set is not finished: the candidates are "possible so far", not a conclusion. */
  provisional?: boolean;
}

const NOT_MUSCLE = /ligament|capsule|disc|labrum/i;
const TIE = 0.02;

/** How many of the inputs are unknown ("not sure", skipped, or never asked). Informational only: scoring does not use it. */
export function unknownCount(input: Pick<NarrowingInput, 'depthAnswer' | 'movementResults'>): number {
  const depthUnknown = !input.depthAnswer || input.depthAnswer.state === 'unknown' ? 1 : 0;
  return depthUnknown + input.movementResults.filter((m) => m.state === 'unknown').length;
}

/** A cluster: the top two candidates tie (confidence within 0.02), so none stands out. */
export function isCluster(candidates: Pick<Candidate, 'confidence'>[]): boolean {
  return candidates.length >= 2 && Math.abs(candidates[0].confidence - candidates[1].confidence) < TIE;
}

/** The muscle structures of one side, without ligaments, capsules, discs and labra. */
export function musclePool(side: Side): string[] {
  return Object.entries(REGION_MAP.structures)
    .filter(([, s]) => s.kind === 'muscle' && s.side === side && !NOT_MUSCLE.test(s.name))
    .map(([id]) => id);
}

/**
 * PLACEHOLDER. Up to 3 candidates from the muscles of the selected side, scored by how well they match the answers that
 * are not unknown. Unknown answers change nothing. Same input, same output.
 */
export function narrow(input: NarrowingInput): NarrowingOutput {
  const side: Side = input.regionId === 'shoulder_left' ? 'left' : 'right';
  const inArea = new Set(structuresIn(input.regionId, input.subRegionId).map((x) => x.id));
  const hit = (id: string) => input.hitMeshName !== null && REGION_MAP.structures[id].meshNames.includes(input.hitMeshName);
  const priorOf = (id: string) => (hit(id) ? NARROWING.priors.tappedStructure : inArea.has(id) ? NARROWING.priors.tappedSubRegion : NARROWING.priors.sameSide);
  const scored = scoreCandidates(musclePool(side), evidenceFrom(input.movementResults, input.answers ?? [], side), priorOf).slice(0, NARROWING.maxCandidatesShown);
  const candidates: Candidate[] = scored.map((s) => ({
    muscleId: s.muscleId,
    confidence: Math.max(0.01, s.strength),
    reason: s.matched.length > 0 ? 'Matches what you reported. May be involved.' : hit(s.muscleId) ? 'Closest to the spot you tapped. May be involved.' : 'Part of the area you marked. May be involved.',
    matched: s.matched,
    unmatched: s.unmatched,
  }));
  // the structure types, from the structure-type answers (strongest first); the screens decide whether muscles may be shown
  const categories: Candidate[] = categoryScores(input.answers ?? []).map((c) => ({
    kind: 'category',
    muscleId: c.category,
    confidence: c.strength,
    reason: 'May be involved.',
    matched: c.matched,
    unmatched: c.unmatched,
  }));
  return { candidates: [...candidates, ...categories], cluster: isCluster(candidates), provisional: true };
}
