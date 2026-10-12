// Region map: region -> sub-region -> structure, from shared/regions_shoulder.json (built by
// scripts/build-region-map.mjs from the structure names). Draft, awaiting clinician review.
import data from '../../../shared/regions_shoulder.json';
import type { BodyLayer, BodySelection, SubRegionId } from './types';

export interface MapStructure {
  label: string;
  name: string;
  side: 'left' | 'right' | null;
  kind: BodyLayer;
  subRegions: SubRegionId[];
  rules: string[];
  meshNames: string[];
  source: string;
  review: string;
}

export interface MapRegion {
  id: string;
  side: 'left' | 'right';
  labels: { en: string; ur: string; roman: string };
  subRegions: Record<SubRegionId, string[]>;
}

export interface RegionMapData {
  label: string;
  subRegions: { id: SubRegionId; labels: { en: string; ur: string; roman: string } }[];
  regions: MapRegion[];
  structures: Record<string, MapStructure>;
  unmapped: { id: string; label: string; kind: BodyLayer; packRegions: string[]; meshCount: number }[];
}

export const REGION_MAP = data as unknown as RegionMapData;

/** "exact": one structure is highlighted. "region": every structure of the tapped area is highlighted. */
export type IntakeMode = 'exact' | 'region';

const byMesh = new Map<string, string>();
for (const [id, s] of Object.entries(REGION_MAP.structures)) for (const m of s.meshNames) byMesh.set(m, id);

/** The map structure a mesh belongs to, or null when the mesh is not a mapped shoulder structure. */
export function structureIdOfMesh(meshName: string): string | null {
  return byMesh.get(meshName) ?? null;
}

/** All structures of a side and sub-region, optionally only one layer. */
export function structuresIn(regionId: string, subRegionId: SubRegionId, kind?: BodyLayer): { id: string; structure: MapStructure }[] {
  const region = REGION_MAP.regions.find((r) => r.id === regionId);
  if (!region) return [];
  return (region.subRegions[subRegionId] ?? [])
    .map((id) => ({ id, structure: REGION_MAP.structures[id] }))
    .filter((x) => x.structure && (!kind || x.structure.kind === kind));
}

/**
 * Mesh names to highlight for a selection.
 * - exact: only the structure that was hit (all its meshes, e.g. both halves of one muscle). Nothing without a hit.
 * - region: every structure of the tapped side and sub-region in the active layer (the whole area).
 */
export function highlightNamesFor(selection: BodySelection | null, mode: IntakeMode): string[] {
  if (!selection) return [];
  if (mode === 'exact') {
    const hit = selection.hitStructure;
    if (!hit) return [];
    const id = structureIdOfMesh(hit.meshName);
    return id ? [...REGION_MAP.structures[id].meshNames] : [hit.meshName];
  }
  return structuresIn(selection.regionId, selection.subRegionId, selection.layer).flatMap((x) => x.structure.meshNames);
}

/** Mesh names of the given structure ids (for result highlights). */
export function meshNamesOfStructures(ids: string[]): string[] {
  return ids.flatMap((id) => REGION_MAP.structures[id]?.meshNames ?? []);
}
