import { formatMeshLabel } from '../screens/model3d/meshNameUtils';
import type { HitStructure, BodyLayer, Point3D, Side, SubRegionId } from './types';

// Approximate centre of each humeral head, taken from the top 4.5 cm of the humerus mesh in body-lite.json
// and moved down 2 cm. TO CONFIRM with a clinician or an anatomy reference; it is only used to label a tap.
export const JOINTS: Record<Side, Point3D> = {
  right: { x: -0.166, y: 1.365, z: -0.026 },
  left: { x: 0.166, y: 1.365, z: -0.026 },
};

/** Taps further than this from a shoulder joint (metres) are not a shoulder tap. */
export const SHOULDER_RADIUS = 0.22;
/** Points more than this far below the joint are the upper arm, not the shoulder. */
export const MAX_BELOW_JOINT = 0.12;

export const SUB_REGIONS: SubRegionId[] = ['front', 'back', 'top', 'side'];

export interface SubRegionResult {
  side: Side;
  regionId: string;
  subRegionId: SubRegionId;
}

const dist = (a: Point3D, b: Point3D) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * Label a tapped point by side and sub-region, or null if it is not near a shoulder.
 * The body faces +z and the patient's right is at negative x. The sub-region is the direction the point lies
 * from the joint: top (up), front (+z), back (-z) or side (outward). Heuristic, not clinically reviewed.
 */
export function subRegionFromPoint(p: Point3D): SubRegionResult | null {
  const side: Side = dist(p, JOINTS.right) <= dist(p, JOINTS.left) ? 'right' : 'left';
  const j = JOINTS[side];
  if (dist(p, j) > SHOULDER_RADIUS) return null;
  const dx = p.x - j.x, dy = p.y - j.y, dz = p.z - j.z;
  if (dy < -MAX_BELOW_JOINT) return null;
  const outward = side === 'right' ? -dx : dx;
  const scores: [SubRegionId, number][] = [
    ['top', dy],
    ['front', dz],
    ['back', -dz],
    ['side', outward],
  ];
  const best = scores.reduce((b, s) => (s[1] > b[1] ? s : b), scores[0]);
  return { side, regionId: `shoulder_${side}`, subRegionId: best[0] };
}

/** Rough 3D point for the figure and list fallbacks, which have no real hit point. */
export function approximatePoint(side: Side, sub: SubRegionId): Point3D {
  const j = JOINTS[side];
  const out = side === 'right' ? -1 : 1;
  const d = 0.05;
  switch (sub) {
    case 'top': return { x: j.x, y: j.y + d, z: j.z };
    case 'front': return { x: j.x, y: j.y, z: j.z + d };
    case 'back': return { x: j.x, y: j.y, z: j.z - d };
    case 'side': return { x: j.x + out * d, y: j.y, z: j.z };
  }
}

/** "Supraspinatus Muscle" from a raw mesh name: readable, English, side removed (the side is shown separately). */
export function structureName(meshName: string): string {
  return formatMeshLabel(meshName)
    .replace(/\s*\((Left|Right)\)\s*$/, '')
    .replace(/Uscle/, 'Muscle'); // typo in the source model: "Scapular_part_of_deltoid_uscle"
}

export function hitStructure(meshName: string, kind: BodyLayer): HitStructure {
  return { meshName, name: structureName(meshName), kind };
}
