// Where to point on the model for a structure type that has no mesh of its own (tendon, bursa, capsule, joint, nerve).
// The nearest bone or muscle region is highlighted and the screens call it an "approximate area".
import { REGION_MAP, structuresIn } from '../regions/regionMap';
import type { BodyLayer, Side, SubRegionId } from '../regions/types';
import type { Category } from './structureBank';

const ofSide = (side: Side) => Object.entries(REGION_MAP.structures).filter(([, s]) => s.side === side);

/** Structure ids to highlight for a category (right-side or left-side structures, by `side`). Empty for nothing to show. */
export function approxAreaIds(category: Category, side: Side, sub: SubRegionId | null): string[] {
  const regionId = `shoulder_${side}`;
  switch (category) {
    case 'JOINT_CAPSULE':
      // the joint capsule and ligaments of the shoulder and the AC joint: they have meshes (kept as "muscle" kind in the map)
      return ofSide(side)
        .filter(([, s]) => /glenohumeral|acromioclavicular|capsule of glenohumeral|coraco acromial/i.test(s.name) || /glenohumeral|acromioclavicular/i.test(s.label))
        .map(([id]) => id);
    case 'BONE': {
      const inArea = sub ? structuresIn(regionId, sub, 'bone').map((x) => x.id) : [];
      const bones = ofSide(side).filter(([, s]) => s.kind === 'bone' && /humerus|clavicle|scapula/i.test(s.name)).map(([id]) => id);
      return inArea.length > 0 ? inArea.filter((id) => /humerus|clavicle|scapula/i.test(REGION_MAP.structures[id].name)) : bones;
    }
    case 'NERVE_NECK':
      // the muscles at the side of the neck, the closest region to the neck that the model shows
      return ofSide(side)
        .filter(([, s]) => /descending part of trapezius|levator scapulae/i.test(s.name))
        .map(([id]) => id);
    default:
      return [];
  }
}

/** Every structure that may be highlighted for a category, so the viewer can give each its own material. */
export function approxTrackedIds(side: Side): string[] {
  const ids = new Set<string>();
  (['JOINT_CAPSULE', 'BONE', 'NERVE_NECK'] as Category[]).forEach((c) => approxAreaIds(c, side, null).forEach((id) => ids.add(id)));
  return [...ids];
}

/** The layer to show for a set of structure ids: bone when they are all bones, else muscle. */
export function layerFor(ids: string[]): BodyLayer {
  return ids.length > 0 && ids.every((id) => REGION_MAP.structures[id]?.kind === 'bone') ? 'bone' : 'muscle';
}
