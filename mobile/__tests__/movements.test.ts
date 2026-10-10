import { CAUTION_EN, COMFORT_LIMITS, LOOP_MS, MOVEMENTS, scapulaFor } from '../src/movement/movements';
import { poseAt } from '../src/movement/pose';
import { buildMovementResult } from '../src/movement/result';
import movementsFile from '../src/data/movements_shoulder.json';

// Sources the brief allows. Nothing else may be cited.
const ALLOWED_SOURCES = ['Michener 2009', 'Park 2005', 'Kelly 1996', 'Gerber 1991', 'Hegedus 2012', 'AAOS range norms'];

describe('movements_shoulder.json', () => {
  it('has the six movements in order', () => {
    expect(MOVEMENTS.map((m) => m.id)).toEqual([
      'sideways_raise',
      'forward_raise',
      'can_position_hold',
      'outward_push_elbow_side',
      'belly_press',
      'hand_behind_back',
    ]);
  });

  it('every entry has sources (only the allowed ones), the caution line and the draft label', () => {
    expect(movementsFile.label).toBe('draft, awaiting clinician review');
    for (const m of MOVEMENTS) {
      expect(m.sources.length).toBeGreaterThanOrEqual(1);
      for (const s of m.sources) expect(ALLOWED_SOURCES).toContain(s);
      expect(m.caution.en).toBe(CAUTION_EN);
      expect(m.caution.ur.length).toBeGreaterThan(5);
      expect(m.caution.roman.length).toBeGreaterThan(5);
      expect(m.review).toBe('draft, awaiting clinician review');
      expect(m.valueNote).toBe('typical value, confirm with physio');
      for (const lang of ['en', 'ur', 'roman'] as const) {
        expect(m.instruction[lang].length).toBeGreaterThan(5);
        expect(m.name[lang].length).toBeGreaterThan(2);
      }
    }
  });

  it('only the sideways and forward raise can be measured with the camera', () => {
    expect(MOVEMENTS.filter((m) => m.cameraMeasurable).map((m) => m.id)).toEqual(['sideways_raise', 'forward_raise']);
  });

  it('keyframes are start, peak, return and never pass the comfortable range', () => {
    for (const m of MOVEMENTS) {
      expect(m.keyframes.map((k) => k.name)).toEqual(['start', 'peak', 'return']);
      expect(m.keyframes.map((k) => k.t)).toEqual([0, 0.5, 1]);
      for (const k of m.keyframes) {
        expect(k.humerusDeg).toBeGreaterThanOrEqual(COMFORT_LIMITS.humerusMin);
        expect(k.humerusDeg).toBeLessThanOrEqual(COMFORT_LIMITS.humerusMax);
        expect(k.elbowDeg).toBeGreaterThanOrEqual(0);
        expect(k.elbowDeg).toBeLessThanOrEqual(COMFORT_LIMITS.elbowMax);
        expect(Math.abs(k.forearmRotationDeg ?? 0)).toBeLessThanOrEqual(COMFORT_LIMITS.forearmRotationMax);
      }
      // returns to where it started
      expect(m.keyframes[2].humerusDeg).toBe(m.keyframes[0].humerusDeg);
    }
  });

  it('the shoulder blade turns about one third of the arm elevation after the first 30 degrees', () => {
    expect(scapulaFor(30)).toBe(0);
    expect(scapulaFor(120)).toBe(30);
    expect(scapulaFor(-30)).toBe(0);
    for (const m of MOVEMENTS) for (const k of m.keyframes) expect(k.scapulaDeg).toBeCloseTo(scapulaFor(k.humerusDeg), 1);
  });
});

describe('animation', () => {
  it('loops slowly, about 4 seconds', () => {
    expect(LOOP_MS).toBe(4000);
  });

  it('eases through start, peak and return', () => {
    const sideways = MOVEMENTS[0];
    expect(poseAt(sideways.keyframes, 0).humerusDeg).toBe(0);
    expect(poseAt(sideways.keyframes, 0.5).humerusDeg).toBe(120);
    expect(poseAt(sideways.keyframes, 1).humerusDeg).toBe(0);
    const quarter = poseAt(sideways.keyframes, 0.25).humerusDeg;
    expect(quarter).toBeGreaterThan(0);
    expect(quarter).toBeLessThan(120);
    // never past the peak
    for (let t = 0; t <= 1; t += 0.05) expect(poseAt(sideways.keyframes, t).humerusDeg).toBeLessThanOrEqual(120.0001);
  });
});

describe('movement result', () => {
  it('has the agreed shape', () => {
    expect(buildMovementResult('sideways_raise', { kind: 'felt', pain: true, weak: false, couldNot: false })).toEqual({
      movementId: 'sideways_raise',
      painful: true,
      weak: false,
      unableToDo: false,
      measuredAngle: null,
      state: 'answered',
    });
  });

  it('"Not sure" and "Skip" give state unknown, never an answered "no"', () => {
    for (const feel of [{ kind: 'unsure' }, { kind: 'skip' }] as const) {
      const r = buildMovementResult('belly_press', feel);
      expect(r.state).toBe('unknown');
      expect(r.measuredAngle).toBeNull();
    }
  });

  it('"No pain" is an answered result, different from unknown', () => {
    const r = buildMovementResult('belly_press', { kind: 'felt', pain: false, weak: false, couldNot: false });
    expect(r.state).toBe('answered');
    expect(r.painful).toBe(false);
  });
});
