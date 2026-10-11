import * as fs from 'fs';
import * as path from 'path';
import { en } from '../src/i18n/en';
import { roman } from '../src/i18n/roman';
import { ur } from '../src/i18n/ur';
import { REGION_MAP, highlightNamesFor, structureIdOfMesh, structuresIn } from '../src/regions/regionMap';
import { SUB_REGIONS } from '../src/regions/subregion';
import { formatMeshLabel } from '../src/screens/model3d/meshNameUtils';
import type { BodySelection } from '../src/regions/types';

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'models', 'pack', 'body-lite.json'), 'utf8'));
const report = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'region-map-report.md'), 'utf8');

// The same shoulder-area words the builder uses (scripts/build-region-map.mjs), to find structures it must account for.
const AREA = /deltoid|scapula|scapular|clavic|humerus|humeral ligament|glenohumeral|glenoid|acromi|supraspinatus|infraspinatus|teres (major|minor)|subscapular|rhomboid|trapezius|pectoralis|latissimus|biceps brachii|triceps brachii|coracobrachialis|coraco|serratus anterior|levator scapulae|omohyoid|brachialis|sternoclavicular|costoclavicular|interclavicular|rotator/i;

/** Structure labels in the manifest, e.g. "Supraspinatus Muscle (Right)", from the same name rules the app uses. */
function manifestLabels(): Set<string> {
  const labels = new Set<string>();
  for (const part of manifest.parts) {
    for (const e of part.meshes as unknown[][]) {
      const raw = e[0] as string;
      labels.add(formatMeshLabel(raw).replace(/Uscle/, 'Muscle'));
    }
  }
  return labels;
}

describe('region map', () => {
  it('every shoulder structure maps to at least one sub-region, or is listed as unmapped in the data and the report', () => {
    const mapped = new Set(Object.values(REGION_MAP.structures).map((s) => s.label));
    const unmapped = new Set(REGION_MAP.unmapped.map((u) => u.label));
    const area = [...manifestLabels()].filter((l) => AREA.test(l.replace(/ \((Left|Right)\)$/, '')));
    expect(area.length).toBeGreaterThan(90);
    const dropped = area.filter((l) => !mapped.has(l) && !unmapped.has(l));
    expect(dropped).toEqual([]);
    for (const s of Object.values(REGION_MAP.structures)) expect(s.subRegions.length).toBeGreaterThanOrEqual(1);
    for (const u of REGION_MAP.unmapped) expect(report).toContain(u.label);
  });

  it('has three levels: region, sub-region, structure, and every id used exists', () => {
    expect(REGION_MAP.regions.map((r) => r.id).sort()).toEqual(['shoulder_left', 'shoulder_right']);
    for (const r of REGION_MAP.regions) {
      expect(Object.keys(r.subRegions).sort()).toEqual([...SUB_REGIONS].sort());
      for (const ids of Object.values(r.subRegions)) for (const id of ids) expect(REGION_MAP.structures[id]).toBeDefined();
    }
  });

  it('a structure can belong to more than one sub-region', () => {
    expect(Object.values(REGION_MAP.structures).some((s) => s.subRegions.length > 1)).toBe(true);
  });

  it('every item carries a source note and the draft label', () => {
    expect(REGION_MAP.label).toBe('draft, awaiting clinician review');
    for (const s of Object.values(REGION_MAP.structures)) {
      expect(s.source.length).toBeGreaterThan(10);
      expect(s.review).toBe('draft, awaiting clinician review');
    }
  });

  it('sub-region labels exist in English, Urdu and Roman Urdu and match the app strings', () => {
    for (const sr of REGION_MAP.subRegions) {
      expect(sr.labels.en).toBe((en.subRegions as Record<string, string>)[sr.id]);
      expect(sr.labels.ur).toBe((ur.subRegions as Record<string, string>)[sr.id]);
      expect(sr.labels.roman).toBe((roman.subRegions as Record<string, string>)[sr.id]);
    }
    expect(REGION_MAP.subRegions.map((s) => s.id).sort()).toEqual([...SUB_REGIONS].sort());
  });
});

describe('highlight: exact mode vs region mode', () => {
  const infra = Object.entries(REGION_MAP.structures).find(([id]) => id === 'infraspinatus_muscle_right')!;
  const hitMesh = infra[1].meshNames[0];
  const selection: BodySelection = {
    regionId: 'shoulder_right',
    subRegionId: 'back',
    point: { x: -0.15, y: 1.3, z: -0.09 },
    hitStructure: { meshName: hitMesh, name: 'Infraspinatus Muscle', kind: 'muscle' },
    layer: 'muscle',
  };

  it('exact mode highlights only the one structure that was hit', () => {
    const names = highlightNamesFor(selection, 'exact');
    expect(names.sort()).toEqual([...infra[1].meshNames].sort());
    expect(new Set(names.map((n) => structureIdOfMesh(n)))).toEqual(new Set(['infraspinatus_muscle_right']));
  });

  it('region mode highlights every structure of the tapped area in the active layer', () => {
    const names = highlightNamesFor(selection, 'region');
    const expected = structuresIn('shoulder_right', 'back', 'muscle').flatMap((x) => x.structure.meshNames);
    expect(names.sort()).toEqual(expected.sort());
    const ids = new Set(names.map((n) => structureIdOfMesh(n)));
    expect(ids.size).toBeGreaterThan(3);
    expect(ids.has('infraspinatus_muscle_right')).toBe(true);
    expect(ids.has('teres_minor_muscle_right')).toBe(true);
    // the left side and the other layer are not part of it
    for (const id of ids) {
      expect(REGION_MAP.structures[id!].side).toBe('right');
      expect(REGION_MAP.structures[id!].kind).toBe('muscle');
    }
  });

  it('region mode highlights more than exact mode, and the exact structure is part of the region', () => {
    const exact = highlightNamesFor(selection, 'exact');
    const region = highlightNamesFor(selection, 'region');
    expect(region.length).toBeGreaterThan(exact.length);
    for (const n of exact) expect(region).toContain(n);
  });

  it('the bone layer in region mode gives bones only', () => {
    const names = highlightNamesFor({ ...selection, layer: 'bone', hitStructure: null }, 'region');
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(REGION_MAP.structures[structureIdOfMesh(n)!].kind).toBe('bone');
  });

  it('exact mode without a hit structure (figure or list) highlights nothing', () => {
    expect(highlightNamesFor({ ...selection, hitStructure: null }, 'exact')).toEqual([]);
    expect(highlightNamesFor(null, 'region')).toEqual([]);
  });
});
