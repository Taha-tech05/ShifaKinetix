// Pure selection logic for the 3D body: which parts are visible per layer, and what a tapped ray selects.
// No three.js imports, so it runs under jest. The parts are the same objects the picker (pick.ts) already uses.
import { pickPack } from '../screens/model3d/pick';
import type { PackPart, PickMesh } from '../screens/model3d/pick';
import { hitStructure, subRegionFromPoint } from './subregion';
import type { BodyLayer, BodySelection, Point3D } from './types';

/**
 * Pack layers that belong to each user-facing layer.
 * "muscle" is all soft tissue (the pack calls it superficial and deep; those labels are a geometry guess, so
 * they are not shown to the user). "bone" is bone. The pack's empty "skin" layer is never shown.
 */
export function layerVisible(packLayer: string, layer: BodyLayer): boolean {
  if (layer === 'bone') return packLayer === 'bone';
  return packLayer === 'superficial' || packLayer === 'deep';
}

/** Show only the parts of the chosen layer. Hidden parts cannot be hit by the picker. */
export function applyLayer<M extends PickMesh>(parts: PackPart<M>[], layer: BodyLayer): void {
  for (const p of parts) p.mesh.visible = layerVisible(p.layer, layer);
}

export type RayResult<M extends PickMesh> =
  /** The first (outermost) hit is near a shoulder: a selection. */
  | { type: 'selection'; selection: BodySelection; part: PackPart<M>; index: number }
  /** Something was hit, but not near a shoulder (neck, chest, upper arm, ...): "Full project" in this demo. */
  | { type: 'outOfScope'; packRegion: string }
  | { type: 'none' };

/**
 * What a tapped ray selects. Only the visible layer is considered, and only the first (outermost) hit counts:
 * in the muscle layer that is the surface muscle, not a deeper one under it; in the bone layer it is a bone.
 * `toModel` converts a point in the ray's space to model space (identity when they are the same).
 */
export function resolveRay<M extends PickMesh>(
  parts: PackPart<M>[],
  layer: BodyLayer,
  origin: ArrayLike<number>,
  direction: ArrayLike<number>,
  toModel: (p: Point3D) => Point3D = (p) => p,
): RayResult<M> {
  applyLayer(parts, layer);
  const h = pickPack(parts, origin, direction)[0];
  if (!h) return { type: 'none' };
  const world: Point3D = {
    x: origin[0] + direction[0] * h.distance,
    y: origin[1] + direction[1] * h.distance,
    z: origin[2] + direction[2] * h.distance,
  };
  const point = toModel(world);
  const sub = subRegionFromPoint(point);
  if (!sub) return { type: 'outOfScope', packRegion: h.part.region };
  return {
    type: 'selection',
    selection: {
      regionId: sub.regionId,
      subRegionId: sub.subRegionId,
      point,
      hitStructure: hitStructure(h.name, layer),
      layer,
    },
    part: h.part,
    index: h.index,
  };
}

/** Like resolveRay, but only the selection case (null for anything else). */
export function selectFromRay<M extends PickMesh>(
  parts: PackPart<M>[],
  layer: BodyLayer,
  origin: ArrayLike<number>,
  direction: ArrayLike<number>,
  toModel?: (p: Point3D) => Point3D,
): { selection: BodySelection; part: PackPart<M>; index: number } | null {
  const r = resolveRay(parts, layer, origin, direction, toModel);
  return r.type === 'selection' ? { selection: r.selection, part: r.part, index: r.index } : null;
}
