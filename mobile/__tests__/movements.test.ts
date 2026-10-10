import movementsFile from '../src/data/movements_shoulder.json';
import { CAUTION_EN, DEFAULT_LOOP_SECONDS, MOVEMENTS, VALUES_LABEL, allowedViolations, mannequinKeyframes, scapulaFor } from '../src/movement/movements';
import { RAMP, easeTrap, poseAt, restPose } from '../src/movement/pose';
import type { Pose } from '../src/movement/pose';
import { buildMovementResult } from '../src/movement/result';

const TEST_LABEL = 'test values, replace with researched data';
const CHANNELS: (keyof Pose)[] = ['elevation', 'plane', 'rotation', 'elbow', 'scapula'];

// Limits chosen for these tests (reported in docs/model-audit/ANIMATION.md).
const MAX_SPEED = 90; // degrees per second, per channel
const MAX_ACCEL = 800; // degrees per second squared, for the arm channels
// The scapula rule (0 below 30 degrees, (elevation - 30) / 3 above) has a speed kink at 30 degrees, which shows up as one
// short acceleration spike in that channel only. It is allowed a higher limit and reported.
const MAX_ACCEL_SCAPULA = 1600;

// Known conflict in the appendix data (reported, values not changed): hand_behind_back allows an elbow of 80 to 110, but
// its rest frames (t=0 and t=1) have the elbow at 0. Nothing else is outside its allowed range.
const KNOWN_ALLOWED_CONFLICTS: Record<string, string[]> = {
  hand_behind_back: ['elbow 0 at t=0 is outside [80, 110]', 'elbow 0 at t=1 is outside [80, 110]'],
};
const MAX_FRAME_JUMP = 2; // degrees between two frames at 60 Hz (90 deg/s is 1.5)

/** Sample a movement at 60 Hz over its whole loop, including the last frame. */
function sample(m: (typeof MOVEMENTS)[number]) {
  const n = Math.round(m.loopSeconds * 60);
  return Array.from({ length: n + 1 }, (_, i) => ({ i, t: i / n, pose: poseAt(m, i / n) }));
}

describe('movements_shoulder.json', () => {
  it('has the six movements, in order', () => {
    expect(MOVEMENTS.map((m) => m.id)).toEqual([
      'sideways_raise',
      'forward_raise',
      'can_position_hold',
      'outward_push_elbow_at_side',
      'belly_press',
      'hand_behind_back',
    ]);
  });

  it('carries the test-values label (file and every movement) and the draft label for patients', () => {
    expect(VALUES_LABEL).toBe(TEST_LABEL);
    expect(movementsFile.label).toBe('draft, awaiting clinician review');
    for (const m of MOVEMENTS) {
      expect(m.valuesLabel).toBe(TEST_LABEL);
      expect(m.review).toBe('draft, awaiting clinician review');
    }
  });

  it('every keyframe angle is inside the allowed range of its movement', () => {
    for (const m of MOVEMENTS) expect(allowedViolations(m)).toEqual(KNOWN_ALLOWED_CONFLICTS[m.id] ?? []);
    // the allowed ranges themselves are the ones in the appendix
    const by = Object.fromEntries(MOVEMENTS.map((m) => [m.id, m.allowed]));
    expect(by.sideways_raise).toEqual({ elevation: [0, 120] });
    expect(by.can_position_hold).toEqual({ elevation: [0, 90] });
    expect(by.outward_push_elbow_at_side).toEqual({ elevation: [0, 15], rotation: [0, 30], elbow: [85, 95] });
    expect(by.belly_press).toEqual({ elevation: [0, 25], rotation: [-60, 0], elbow: [85, 100] });
    expect(by.hand_behind_back).toEqual({ elevation: [-45, 0], rotation: [-80, 0], elbow: [80, 110] });
  });

  it('keyframe times increase and cover 0 to 1', () => {
    for (const m of MOVEMENTS) {
      expect(m.frames[0].t).toBe(0);
      expect(m.frames[m.frames.length - 1].t).toBe(1);
      for (let i = 1; i < m.frames.length; i++) expect(m.frames[i].t).toBeGreaterThan(m.frames[i - 1].t);
    }
  });

  it('keeps the caution line, the instructions in three languages, and no citation on the test values', () => {
    for (const m of MOVEMENTS) {
      expect(m.caution.en).toBe(CAUTION_EN);
      for (const lang of ['en', 'ur', 'roman'] as const) {
        expect(m.instruction[lang].length).toBeGreaterThan(5);
        expect(m.name[lang].length).toBeGreaterThan(2);
      }
      expect(JSON.stringify(m.frames)).not.toMatch(/\d{4}/); // no year or citation inside the values
    }
  });

  it('only the sideways and forward raise can be measured with the camera', () => {
    expect(MOVEMENTS.filter((m) => m.cameraMeasurable).map((m) => m.id)).toEqual(['sideways_raise', 'forward_raise']);
  });

  it('names the muscles to highlight, and the structures exist in the region map', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const map = require('../../shared/regions_shoulder.json');
    for (const m of MOVEMENTS) {
      expect(m.suggests.length).toBeGreaterThan(0);
      for (const id of m.suggestsStructures) expect(map.structures[id]).toBeDefined();
    }
  });

  it('can be shown on the simple diagram too', () => {
    for (const m of MOVEMENTS) expect(mannequinKeyframes(m).length).toBe(m.frames.length);
  });
});

describe('pose function', () => {
  it('starts and ends at the rest pose, so the loop is seamless', () => {
    for (const m of MOVEMENTS) {
      expect(poseAt(m, 0)).toEqual(restPose(m));
      expect(poseAt(m, 1)).toEqual(restPose(m));
    }
  });

  it('hits every stated keyframe, including the peak', () => {
    for (const m of MOVEMENTS) {
      for (const f of m.frames) {
        const p = poseAt(m, f.t);
        expect(p.elevation).toBeCloseTo(f.elevation, 9);
        expect(p.plane).toBeCloseTo(f.plane, 9);
        expect(p.rotation).toBeCloseTo(f.rotation, 9);
        expect(p.elbow).toBeCloseTo(f.elbow, 9);
      }
      const peak = m.frames.reduce((b, f) => (Math.abs(f.elevation) + Math.abs(f.rotation) + f.elbow > Math.abs(b.elevation) + Math.abs(b.rotation) + b.elbow ? f : b));
      const p = poseAt(m, peak.t);
      expect(p.elevation).toBeCloseTo(peak.elevation, 9);
    }
    expect(poseAt(MOVEMENTS[0], 0.45).elevation).toBe(120);
    expect(poseAt(MOVEMENTS[2], 0.3).elevation).toBe(90);
  });

  it('the shoulder blade follows (elevation - 30) / 3 above 30 degrees and is 0 below', () => {
    expect(scapulaFor(0)).toBe(0);
    expect(scapulaFor(30)).toBe(0);
    expect(scapulaFor(120)).toBe(30);
    expect(scapulaFor(90)).toBe(20);
    expect(scapulaFor(-30)).toBe(0); // negative elevation (backward) never gives a negative scapula value
    for (const m of MOVEMENTS) {
      for (const { pose } of sample(m)) {
        const expected = pose.elevation > 30 ? (pose.elevation - 30) / 3 : 0;
        expect(pose.scapula).toBeCloseTo(expected, 9);
        expect(pose.scapula).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('never goes outside the allowed range between keyframes (apart from the known conflict at rest)', () => {
    const eps = 1e-9;
    for (const m of MOVEMENTS) {
      const a = m.allowed;
      for (const { pose } of sample(m)) {
        if (a.elevation) {
          expect(pose.elevation).toBeGreaterThanOrEqual(a.elevation[0] - eps);
          expect(pose.elevation).toBeLessThanOrEqual(a.elevation[1] + eps);
        }
        if (a.rotation) {
          expect(pose.rotation).toBeGreaterThanOrEqual(a.rotation[0] - eps);
          expect(pose.rotation).toBeLessThanOrEqual(a.rotation[1] + eps);
        }
        if (a.elbow && m.id !== 'hand_behind_back') {
          expect(pose.elbow).toBeGreaterThanOrEqual(a.elbow[0] - eps);
          expect(pose.elbow).toBeLessThanOrEqual(a.elbow[1] + eps);
        }
        if (a.elbow && m.id === 'hand_behind_back') expect(pose.elbow).toBeLessThanOrEqual(a.elbow[1] + eps); // never above 110
      }
    }
  });

  it('eases in and out: the position is 0 at the start, 1 at the end, and rises smoothly', () => {
    expect(easeTrap(0)).toBe(0);
    expect(easeTrap(1)).toBeCloseTo(1, 12);
    expect(easeTrap(0.5)).toBeCloseTo(0.5, 12);
    let prev = 0;
    for (let x = 0.001; x <= 1; x += 0.001) {
      const v = easeTrap(x);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
    expect(RAMP).toBeGreaterThan(0);
  });
});

describe('smoothness at 60 Hz', () => {
  const report: string[] = [];

  it.each(MOVEMENTS.map((m) => [m.id, m] as const))('%s: no jumps, speed and acceleration within limits', (_id, m) => {
    const s = sample(m);
    let maxJump = 0, maxSpeed = 0, maxAccel = 0, maxAccelScapula = 0;
    for (const ch of CHANNELS) {
      for (let i = 1; i < s.length; i++) {
        const d = s[i].pose[ch] - s[i - 1].pose[ch];
        maxJump = Math.max(maxJump, Math.abs(d));
        maxSpeed = Math.max(maxSpeed, Math.abs(d) * 60);
        if (i >= 2) {
          const dd = s[i].pose[ch] - 2 * s[i - 1].pose[ch] + s[i - 2].pose[ch];
          if (ch === 'scapula') maxAccelScapula = Math.max(maxAccelScapula, Math.abs(dd) * 3600);
          else maxAccel = Math.max(maxAccel, Math.abs(dd) * 3600);
        }
      }
    }
    report.push(`${m.id}: loop ${m.loopSeconds}s, max jump ${maxJump.toFixed(2)} deg/frame, max speed ${maxSpeed.toFixed(1)} deg/s, max acceleration arm ${maxAccel.toFixed(0)} / scapula ${maxAccelScapula.toFixed(0)} deg/s^2`);
    expect(maxJump).toBeLessThan(MAX_FRAME_JUMP);
    expect(maxSpeed).toBeLessThan(MAX_SPEED);
    expect(maxAccel).toBeLessThan(MAX_ACCEL);
    expect(maxAccelScapula).toBeLessThan(MAX_ACCEL_SCAPULA);
  });

  it('hold segments are perfectly still', () => {
    let holds = 0;
    for (const m of MOVEMENTS) {
      for (let k = 1; k < m.frames.length; k++) {
        const a = m.frames[k - 1], b = m.frames[k];
        if (a.elevation === b.elevation && a.plane === b.plane && a.rotation === b.rotation && a.elbow === b.elbow && a.t !== 0 && b.t !== 1) {
          holds++;
          const first = poseAt(m, a.t);
          const n = Math.round(m.loopSeconds * 60);
          for (let i = Math.ceil(a.t * n); i <= Math.floor(b.t * n); i++) expect(poseAt(m, i / n)).toEqual(first);
        }
      }
    }
    expect(holds).toBeGreaterThanOrEqual(5); // sideways, forward, can, push, belly, behind back all hold
  });

  it('the loop is about 4 seconds (5 for the can position, so its return stays under the speed limit)', () => {
    expect(DEFAULT_LOOP_SECONDS).toBe(4);
    for (const m of MOVEMENTS) expect(m.loopSeconds).toBe(m.id === 'can_position_hold' ? 5 : 4);
  });

  afterAll(() => console.log('SMOOTHNESS (limits: speed < ' + MAX_SPEED + ' deg/s, acceleration < ' + MAX_ACCEL + ' (scapula ' + MAX_ACCEL_SCAPULA + ') deg/s^2, jump < ' + MAX_FRAME_JUMP + ' deg/frame)\n' + report.join('\n')));
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
