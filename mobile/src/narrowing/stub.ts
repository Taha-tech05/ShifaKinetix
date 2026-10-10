// PLACEHOLDER narrowing step. Person C replaces this with the real narrowing. It lives outside gate/ on purpose.
// Input and output shapes follow shared/formats.md (format 4) plus the new body-selection inputs.
import type { BodyLayer, Point3D, SubRegionId } from '../regions/types';
import type { MovementResult } from '../store/session';

/** Answer to the depth question. null (not asked yet) is different from "unknown" (the patient said not sure). */
export interface DepthAnswer {
  state: 'answered' | 'unknown';
  /** null when state is "unknown". "Not sure" is never turned into one of the other answers. */
  value: 'just_under_skin' | 'deep_inside' | null;
}

export interface NarrowingInput {
  /** The layer the patient tapped in: "muscle" or "bone". */
  layer: BodyLayer;
  subRegionId: SubRegionId;
  point: Point3D;
  depthAnswer: DepthAnswer | null;
  movementResults: MovementResult[];
}

export interface NarrowingOutput {
  candidates: { muscleId: string; confidence: number; reason: string }[];
  cluster: boolean;
}

/**
 * PLACEHOLDER. Returns no candidates: nothing here is clinical. It only fixes the input and output shapes so the
 * screens can be built; the real narrowing uses layer, subRegionId, point, depthAnswer and movementResults.
 */
export function narrowStub(_input: NarrowingInput): NarrowingOutput {
  return { candidates: [], cluster: false };
}
