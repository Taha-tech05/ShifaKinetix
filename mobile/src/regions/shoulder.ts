import type { TKey } from '../i18n';

export interface ShoulderRegion {
  regionId: string;
  labelKey: TKey;
}

/** Shoulder regions offered for tapping until the 3D body viewer is wired in. */
export const SHOULDER_REGIONS: ShoulderRegion[] = [
  { regionId: 'shoulder_right_front', labelKey: 'regions.shoulder_right_front' },
  { regionId: 'shoulder_right_back', labelKey: 'regions.shoulder_right_back' },
  { regionId: 'shoulder_right_top', labelKey: 'regions.shoulder_right_top' },
  { regionId: 'shoulder_left_front', labelKey: 'regions.shoulder_left_front' },
  { regionId: 'shoulder_left_back', labelKey: 'regions.shoulder_left_back' },
  { regionId: 'shoulder_left_top', labelKey: 'regions.shoulder_left_top' },
];

export function regionLabelKey(regionId: string): TKey | null {
  return SHOULDER_REGIONS.find((r) => r.regionId === regionId)?.labelKey ?? null;
}
