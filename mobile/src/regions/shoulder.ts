import type { TKey } from '../i18n';
import { t } from '../i18n';
import { SUB_REGIONS } from './subregion';
import type { Side, SubRegionId } from './types';

export interface ShoulderRegion {
  /** "shoulder_right" or "shoulder_left". */
  regionId: string;
  side: Side;
  subRegionId: SubRegionId;
}

/** Every side and sub-region, for the plain list shown when the 3D body is not available. */
export const SHOULDER_REGIONS: ShoulderRegion[] = (['right', 'left'] as Side[]).flatMap((side) =>
  SUB_REGIONS.map((subRegionId) => ({ regionId: `shoulder_${side}`, side, subRegionId })),
);

/** Id used to highlight a choice in the figure and the list: side and sub-region together. */
export function selectionKey(regionId: string, subRegionId: SubRegionId): string {
  return `${regionId}_${subRegionId}`;
}

const REGION_KEYS: Record<string, TKey> = { shoulder_right: 'regions.shoulder_right', shoulder_left: 'regions.shoulder_left' };
const SUB_KEYS: Record<SubRegionId, TKey> = {
  top: 'subRegions.top',
  front: 'subRegions.front',
  back: 'subRegions.back',
  side: 'subRegions.side',
  scapular: 'subRegions.scapular',
};

/** "Right shoulder, top" in the current language. Returns null for an unknown region. */
export function regionLabel(regionId: string, subRegionId: SubRegionId): string | null {
  const key = REGION_KEYS[regionId];
  if (!key) return null;
  return t('regions.label', { region: t(key), sub: t(SUB_KEYS[subRegionId]) });
}

/** The side of a region id: "shoulder_left" is left, anything else right. */
export function sideOfRegion(regionId: string | null | undefined): Side {
  return regionId === 'shoulder_left' ? 'left' : 'right';
}
