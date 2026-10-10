// PLACEHOLDER, Person C replaces. Dummy narrowing so the result screens can be built.
// It makes NO clinical claim beyond "may be involved". Scores come from a fixed hash of the ids, not from medicine.
// To replace it, change the body of narrow() (or the import in flow/intake.ts). Nothing else calls the stub.
// Output shape is the agreed one: {candidates: [{muscleId, confidence, reason}], cluster} (shared/formats.md, format 4).
import { structuresIn } from '../regions/regionMap';
import type { BodyLayer, Point3D, SubRegionId } from '../regions/types';
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
}

export interface Candidate {
  /** Id of a structure in shared/regions_shoulder.json. */
  muscleId: string;
  confidence: number;
  reason: string;
}

export interface NarrowingOutput {
  candidates: Candidate[];
  cluster: boolean;
}

const NOT_MUSCLE = /ligament|capsule|disc|labrum/i;
const MAX_CANDIDATES = 3;
const TIE = 0.02;

/** Fixed pseudo-random number in [0, 1) from a string. Same input, same output. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** How many of the inputs are unknown ("not sure", skipped, or never asked). */
export function unknownCount(input: Pick<NarrowingInput, 'depthAnswer' | 'movementResults'>): number {
  const depthUnknown = !input.depthAnswer || input.depthAnswer.state === 'unknown' ? 1 : 0;
  return depthUnknown + input.movementResults.filter((m) => m.state === 'unknown').length;
}

/** A cluster: the top two candidates tie (confidence within 0.02), so none stands out. */
export function isCluster(candidates: Pick<Candidate, 'confidence'>[]): boolean {
  return candidates.length >= 2 && Math.abs(candidates[0].confidence - candidates[1].confidence) < TIE;
}

/** PLACEHOLDER. 1 to 3 candidates from the muscles of the chosen area; lower confidence when answers are unknown. */
export function narrow(input: NarrowingInput): NarrowingOutput {
  const pool = structuresIn(input.regionId, input.subRegionId).filter(
    (x) => x.structure.kind === 'muscle' && !NOT_MUSCLE.test(x.structure.name),
  );
  const penalty = 1 - Math.min(0.5, 0.1 * unknownCount(input));
  const scored = pool.map(({ id, structure }) => {
    const isHit = input.hitMeshName !== null && structure.meshNames.includes(input.hitMeshName);
    const raw = 0.3 + 0.3 * hash01(`${input.subRegionId}:${id}`) + (isHit ? 0.25 : 0);
    return {
      muscleId: id,
      confidence: Math.round(Math.min(0.9, raw) * penalty * 100) / 100,
      reason: isHit ? 'Closest to the spot you tapped. May be involved.' : 'Part of the area you marked. May be involved.',
    };
  });
  scored.sort((a, b) => b.confidence - a.confidence || a.muscleId.localeCompare(b.muscleId));
  const candidates = scored.slice(0, MAX_CANDIDATES);
  return { candidates, cluster: isCluster(candidates) };
}
