import { narrow } from '../src/dev/narrowingStub';
import type { NarrowingInput } from '../src/dev/narrowingStub';
import { planFocus } from '../src/components/body3d/focusPlan';
import { evaluateLive } from '../src/narrowing/live';
import { evidenceFrom } from '../src/narrowing/scoring';
import { structureMuscles } from '../src/narrowing/structureBank';
import { buildMovementResult } from '../src/movement/result';

type A = { questionId: string; type: string; value: boolean | null; state: 'answered' | 'unknown' };
const yes = (id: string): A => ({ questionId: id, type: 'yesno', value: true, state: 'answered' });
const no = (id: string): A => ({ questionId: id, type: 'yesno', value: false, state: 'answered' });
const unsure = (id: string): A => ({ questionId: id, type: 'yesno', value: null, state: 'unknown' });
const input = (answers: A[], over: Partial<NarrowingInput> = {}): NarrowingInput => ({
  layer: 'muscle',
  regionId: 'shoulder_right',
  subRegionId: 'top',
  point: { x: -0.17, y: 1.4, z: -0.03 },
  hitMeshName: null,
  depthAnswer: null,
  movementResults: [],
  ...over,
  answers,
});
const ids = (a: A[], over: Partial<NarrowingInput> = {}) => evaluateLive(input(a, over), 'exact').candidates.map((c) => c.muscleId);
const top = (a: A[], over: Partial<NarrowingInput> = {}) => evaluateLive(input(a, over), 'exact').candidates[0];

describe('the muscle candidates really move with the answers (not stuck on Low)', () => {
  it('the structure-type questions speak about muscles, for both sides, and a skip adds nothing', () => {
    expect(structureMuscles('Q_ST_NIGHT', 'right')).toEqual(['supraspinatus_muscle_right', 'infraspinatus_muscle_right']);
    expect(structureMuscles('Q_ST_NIGHT', 'left')).toEqual(['supraspinatus_muscle_left', 'infraspinatus_muscle_left']);
    expect(evidenceFrom([], [unsure('Q_ST_NIGHT')], 'right')).toEqual([]);
    expect(evidenceFrom([], [yes('Q_ST_NIGHT')], 'right')).toHaveLength(1);
    expect(structureMuscles('Q_ST_BONE_POINT', 'right')).toEqual([]); // a bone question says nothing about a muscle
  });

  it('one matching answer lifts the muscles it speaks about above the seed, two reach Higher', () => {
    const seed = top([]);
    expect(seed.band).toBe('low');
    const one = evaluateLive(input([yes('Q_ST_NIGHT')]), 'exact').candidates.find((c) => c.muscleId === 'supraspinatus_muscle_right')!;
    expect(one.strength).toBeGreaterThan(seed.strength);
    expect(one.band).not.toBe('low');
    const two = evaluateLive(input([yes('Q_ST_NIGHT'), yes('Q_ST_PASSIVE_BETTER')]), 'exact').candidates.find((c) => c.muscleId === 'supraspinatus_muscle_right')!;
    expect(two.band).toBe('higher');
  });

  it('different answers give different candidates, so the camera has a new set to frame', () => {
    const none = ids([]);
    const night = ids([yes('Q_ST_NIGHT')]);
    const neck = ids([yes('Q_ST_NECK'), yes('Q_ST_TINGLE')]);
    expect(night).not.toEqual(none);
    expect(neck).not.toEqual(night);
    expect(neck.some((id) => /trapezius|levator/.test(id))).toBe(true);
    // the auto-focus plan triggers on each change and not when the set stays the same
    let last = '';
    const run = (set: string[]) => {
      const p = planFocus(last, set);
      if (p.run) last = p.key;
      return p.run;
    };
    expect(run(none)).toBe(true);
    expect(run(night)).toBe(true);
    expect(run(night)).toBe(false);
    expect(run(neck)).toBe(true);
  });

  it('a "no" can pull a muscle down, a skip changes nothing', () => {
    const base = evaluateLive(input([yes('Q_ST_NIGHT')]), 'exact').candidates.find((c) => c.muscleId === 'supraspinatus_muscle_right')!;
    const worse = evaluateLive(input([yes('Q_ST_NIGHT'), no('Q_ST_PASSIVE_BETTER')]), 'exact').candidates.find((c) => c.muscleId === 'supraspinatus_muscle_right')!;
    const same = evaluateLive(input([yes('Q_ST_NIGHT'), unsure('Q_ST_PASSIVE_BETTER'), unsure('Q_ST_NECK')]), 'exact').candidates.find((c) => c.muscleId === 'supraspinatus_muscle_right')!;
    expect(worse.strength).toBeLessThan(base.strength);
    expect(same.strength).toBe(base.strength);
  });

  it('movements move the candidates too: pain in two movements makes the muscle they share Higher', () => {
    const moves = [buildMovementResult('sideways_raise', { kind: 'felt', pain: true, weak: false, couldNot: false }), buildMovementResult('can_position_hold', { kind: 'felt', pain: true, weak: false, couldNot: false })];
    const s = evaluateLive(input([]), 'region');
    const after = evaluateLive(input([], { movementResults: moves }), 'region');
    expect(after.candidates[0].muscleId).toBe('supraspinatus_muscle_right');
    expect(after.candidates[0].band).toBe('higher');
    expect(after.candidates[0].strength).toBeGreaterThan(s.candidates[0].strength);
  });

  it('the stub still returns the agreed shape', () => {
    const out = narrow(input([yes('Q_ST_NIGHT')]));
    expect(typeof out.cluster).toBe('boolean');
    for (const c of out.candidates) expect(typeof c.confidence).toBe('number');
  });
});
