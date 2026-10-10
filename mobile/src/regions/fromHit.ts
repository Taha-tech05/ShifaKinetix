import { formatMeshLabel } from '../screens/model3d/meshNameUtils';
import { SHOULDER_REGIONS } from './shoulder';

/** Pack regions (from the model's own region map) that count as "the shoulder" for this app. */
export const SHOULDER_PACK_REGIONS = new Set(['shoulder', 'upper_arm', 'upper_back', 'chest_ribcage', 'neck_cervical']);

export interface HitInfo {
  /** Region name stored in the pack for the tapped part, e.g. "shoulder". */
  packRegion: string;
  /** Source mesh name, e.g. "Supraspinatus_musclel_Generated_Mesh_From_X3D170". */
  meshName: string;
  /** Hit point x in model space. Used for the side when the mesh name has no l/r suffix. */
  x: number;
  /** Current turn of the model (radians). 0 = facing the viewer. */
  yaw: number;
  /** Current tilt of the model (radians). Positive = looking from above. */
  pitch: number;
}

const TOP_PITCH = 0.9;

/**
 * Turn a 3D tap into one of the plain shoulder region ids, or null if the tap was not near the shoulder.
 * Heuristic, not clinically reviewed: side comes from the mesh name suffix (l/r) when present,
 * otherwise from the sign of x (the model faces the viewer, so +x is the patient's left).
 * Front, back or top comes from how the model was turned when the tap happened.
 */
export function shoulderRegionFromHit(hit: HitInfo): string | null {
  if (!SHOULDER_PACK_REGIONS.has(hit.packRegion)) return null;
  const label = formatMeshLabel(hit.meshName);
  const side = label.endsWith('(Left)') ? 'left' : label.endsWith('(Right)') ? 'right' : hit.x > 0 ? 'left' : 'right';
  let view: 'front' | 'back' | 'top';
  if (hit.pitch > TOP_PITCH) view = 'top';
  else {
    const turn = Math.atan2(Math.sin(hit.yaw), Math.cos(hit.yaw)); // wrap to [-pi, pi]
    view = Math.abs(turn) <= Math.PI / 2 ? 'front' : 'back';
  }
  const id = `shoulder_${side}_${view}`;
  return SHOULDER_REGIONS.some((r) => r.regionId === id) ? id : null;
}
