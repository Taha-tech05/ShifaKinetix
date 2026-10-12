import { MOVEMENTS, scapulaFor } from '../src/movement/movements';
import { endPose, poseAt } from '../src/movement/pose';
import type { Pose } from '../src/movement/pose';
import { ARM_RIG, ARM_RIG_LEFT, apply, armTransforms, arrowDirection, elevationDirection, jointPositions, lengthOf, mirrorRig, reflectX, rigFor, sub3 } from '../src/movement/rig';
import type { Vec3 } from '../src/movement/rig';
import { armPoints, clearanceOf, hasPack, loadMeshes, trunkEnvelope } from './support/clearance';

const mk = (elevation: number, plane = 0, rot = 0, elbow = 0): Pose => ({ elevation, plane, rotation: rot, elbow, scapula: scapulaFor(elevation) });
const hbb = MOVEMENTS.find((m) => m.id === 'hand_behind_back')!;
const wristOf = (p: Pose, rig = ARM_RIG) => apply(armTransforms(p, rig).forearm, rig.pivots.wrist);
const elbowOf = (p: Pose, rig = ARM_RIG) => apply(armTransforms(p, rig).forearm, rig.pivots.elbow);
const mirror = (v: Vec3): Vec3 => [-v[0], v[1], v[2]];

describe('hand behind back: placeholder kinematics', () => {
  it('is labelled as test values and keeps the movement note', () => {
    expect(hbb.valuesLabel).toBe('test values, replace with researched data');
    expect(hbb.movementNote).toBe('Adapted from clinician-administered positions (lift-off / Apley scratch); self-administered version not validated.');
    expect(hbb.review).toBe('draft, awaiting clinician review');
    expect(hbb.kinematicsNote).toMatch(/PLACEHOLDER/);
    expect(JSON.stringify(hbb)).not.toMatch(/doctor-validated|clinician-validated/i);
  });

  it('uses shoulder extension, a little adduction, internal rotation and an elbow bent to about 90 degrees', () => {
    const hold = endPose(hbb);
    expect(hold.elevation).toBeLessThan(-25); // extension: negative elevation
    expect(hold.elevation).toBeGreaterThanOrEqual(-55);
    expect(hold.plane).toBeLessThan(90); // some adduction (inward component) on top of the extension
    expect(hold.plane).toBeGreaterThan(60); // mostly backward
    expect(hold.rotation).toBeLessThanOrEqual(-80); // internal rotation
    expect(hold.elbow).toBeGreaterThanOrEqual(80);
    expect(hold.elbow).toBeLessThanOrEqual(110);
    expect(hold.scapula).toBe(0); // the scapula rule gives nothing below 30 degrees of elevation
    expect(scapulaFor(hold.elevation)).toBe(0);
  });

  it('goes back first, then rotates, then bends the elbow, then slides up; and returns the same way, slower', () => {
    const k = hbb.frames;
    expect(k[1].elevation).toBeLessThan(0);
    expect(k[1].rotation).toBeLessThan(-60);
    expect(k[1].elbow).toBe(0); // the elbow is still straight when the arm has gone back
    expect(k[2].elbow).toBeGreaterThan(30); // then it bends: the hand passes behind the pelvis
    expect(k[3].elbow).toBeGreaterThan(k[2].elbow); // then the slide up the lower back
    expect(k[4]).toMatchObject({ elevation: k[3].elevation, rotation: k[3].rotation, elbow: k[3].elbow }); // brief hold
    const hold = (k[4].t - k[3].t) * hbb.loopSeconds;
    expect(hold).toBeGreaterThanOrEqual(0.95);
    expect(hold).toBeLessThanOrEqual(1.5);
    expect(k[5].elbow).toBe(k[2].elbow); // same way back
    expect((1 - k[4].t) * hbb.loopSeconds).toBeGreaterThan(k[3].t * hbb.loopSeconds * 1.2);
  });

  it('the hand goes lower first (pelvis) and then higher (lumbar), and the forearm crosses towards the midline', () => {
    const pelvis = wristOf(poseAt(hbb, hbb.frames[2].t));
    const lumbar = wristOf(poseAt(hbb, hbb.frames[3].t));
    expect(lumbar[1]).toBeGreaterThan(pelvis[1] + 0.03); // slides up
    const elbow = elbowOf(poseAt(hbb, hbb.frames[3].t));
    expect(lumbar[0]).toBeGreaterThan(elbow[0] + 0.1); // forearm runs medially (+x for the right arm)
    expect(lumbar[2]).toBeLessThan(0); // behind the body (the front is +z)
    expect(elbow[2]).toBeLessThan(-0.1);
  });
});

describe('negative elevation: extension and adduction', () => {
  const rest = ARM_RIG.pivots;
  it('plane 90 is straight backward, plane 0 is straight inward, planes between are both', () => {
    const rv: Vec3 = [0, -1, 0];
    const back = elevationDirection(90, -30, rv);
    expect(back[2]).toBeLessThan(-0.99);
    const inward = elevationDirection(0, -30, rv);
    expect(inward[0]).toBeGreaterThan(0.99); // +x is towards the midline for the right arm
    const both = elevationDirection(45, -30, rv);
    expect(both[0]).toBeGreaterThan(0.6);
    expect(both[2]).toBeLessThan(-0.6);
    expect(elevationDirection(45, 30, rv)[0]).toBeLessThan(-0.6); // positive elevation is unchanged: outward
  });

  it('moves the wrist backward, with a small inward part at plane 80', () => {
    const w0 = wristOf(mk(0, 80));
    const w = wristOf(mk(-35, 80));
    expect(w[2]).toBeLessThan(w0[2] - 0.12);
    const w90 = wristOf(mk(-35, 90));
    expect(w[0]).toBeGreaterThan(w90[0]); // more inward than the pure extension
    void rest;
  });
});

describe('left arm = mirror image of the right arm', () => {
  const left = ARM_RIG_LEFT;
  it('is built from the left meshes: other side of x, own segments, same sizes', () => {
    expect(left.side).toBe('left');
    for (const p of [left.pivots.humeralHead, left.pivots.glenoid, left.pivots.elbow, left.pivots.wrist]) expect(p[0]).toBeGreaterThan(0.1);
    const r = new Set(Object.values(ARM_RIG.segments).flat());
    for (const n of Object.values(left.segments).flat()) expect(r.has(n)).toBe(false);
    for (const k of ['girdle', 'upper', 'forearm', 'hand'] as const) expect(left.segments[k].length).toBe(ARM_RIG.segments[k].length);
    expect(left.pivots.headToGlenoid).toBeCloseTo(ARM_RIG.pivots.headToGlenoid, 2);
  });

  it('the model is symmetric to a few millimetres (pivots of the left arm are the mirrored right pivots)', () => {
    for (const k of ['humeralHead', 'glenoid', 'elbow', 'wrist', 'sternoclavicular'] as const) {
      expect(lengthOf(sub3(left.pivots[k], mirror(ARM_RIG.pivots[k])))).toBeLessThan(0.006);
    }
  });

  it('every movement, every sampled pose: the left joints are the mirrored right joints (within the model asymmetry)', () => {
    let worst = 0;
    for (const m of MOVEMENTS) {
      for (let i = 0; i <= 40; i++) {
        const pose = poseAt(m, i / 40);
        const jr = jointPositions(pose, ARM_RIG);
        const jl = jointPositions(pose, left);
        for (const k of ['humeralHead', 'glenoid', 'elbow', 'wrist'] as const) worst = Math.max(worst, lengthOf(sub3(jl[k], mirror(jr[k]))));
      }
    }
    expect(worst).toBeLessThan(0.012); // 12 mm: the pivots differ by up to 3.6 mm and the error grows with the lever arm
  });

  it('the left head stays on the left glenoid, and the left elbow rides on the left upper arm', () => {
    const gap0 = lengthOf(sub3(left.pivots.humeralHead, left.pivots.glenoid));
    for (const m of MOVEMENTS) {
      for (let i = 0; i <= 30; i++) {
        const pose = poseAt(m, i / 30);
        const j = jointPositions(pose, left);
        expect(Math.abs(lengthOf(sub3(j.humeralHead, j.glenoid)) - gap0)).toBeLessThan(1e-6);
        const t = armTransforms(pose, left);
        expect(lengthOf(sub3(apply(t.forearm, left.pivots.elbow), apply(t.upper, left.pivots.elbow)))).toBeLessThan(1e-9);
      }
    }
  });

  it('uses the same sign conventions mirrored: raise goes out (+x), extension goes back, internal rotation turns the hand in', () => {
    const wL = (p: Pose) => wristOf(p, left);
    const rest = wL(mk(0));
    expect(wL(mk(90, 0))[0]).toBeGreaterThan(rest[0] + 0.1); // up and out (+x for the left arm)
    expect(wL(mk(90, 90))[2]).toBeGreaterThan(rest[2] + 0.2); // forward
    expect(wL(mk(-35, 90))[2]).toBeLessThan(rest[2] - 0.1); // backward
    const hand0 = wL(mk(0, 0, 0, 90));
    expect(wL(mk(0, 0, 20, 90))[0]).toBeGreaterThan(hand0[0] + 0.03); // external rotation: hand swings outward
    expect(wL(mk(0, 0, -45, 90))[0]).toBeLessThan(hand0[0] - 0.03); // internal rotation: hand swings inward
  });

  it('reflectX and mirrorRig are their own inverses', () => {
    const m = armTransforms(mk(70, 30, 10, 40)).upper;
    expect(reflectX(reflectX(m))).toEqual(m);
    const twice = mirrorRig(mirrorRig(left));
    twice.pivots.humeralHead.forEach((v, i) => expect(v).toBeCloseTo(left.pivots.humeralHead[i], 9));
    expect(rigFor('left')).toBe(left);
    expect(rigFor('right')).toBe(ARM_RIG);
  });

  it('resist arrows are mirrored for the left side (inward is -x)', () => {
    expect(arrowDirection('inward', 'right')).toEqual([1, 0, 0]);
    expect(arrowDirection('inward', 'left')).toEqual([-1, 0, 0]);
    expect(arrowDirection('down', 'left')[1]).toBe(-1);
    expect(Math.abs(arrowDirection('down', 'left')[0])).toBe(0);
    expect(arrowDirection('toward trunk', 'left')).toEqual([0, 0, -1]);
  });
});

// ---- measured on the real pack (skipped with a message when the pack is not in the working copy) ----
(hasPack ? describe : describe.skip)('real pack: the arm does not go through the trunk', () => {
  const meshes = hasPack ? loadMeshes() : [];
  const env = hasPack ? trunkEnvelope(meshes) : { at: () => undefined };
  const pointsOf = { right: hasPack ? armPoints(meshes, 'right') : { upper: [], forearm: [], hand: [] }, left: hasPack ? armPoints(meshes, 'left') : { upper: [], forearm: [], hand: [] } };
  // millimetres of overlap that are normal where soft-tissue meshes touch
  const LIMIT = { upper: 0.02, forearm: 0.012, hand: 0.015 };
  const table: string[] = [];

  it.each(['right', 'left'] as const)('hand behind back, %s side: no pose along the whole loop is deeper in the trunk than the limits', (side) => {
    let worst = { upper: 0, forearm: 0, hand: 0 };
    let minGap = Infinity;
    for (let i = 0; i <= 180; i++) {
      const t = i / 180;
      const c = clearanceOf(env, pointsOf[side], poseAt(hbb, t), side);
      worst = { upper: Math.max(worst.upper, c.upper), forearm: Math.max(worst.forearm, c.forearm), hand: Math.max(worst.hand, c.hand) };
      if (t > 0.17 && t < 0.83) minGap = Math.min(minGap, c.backGap);
    }
    table.push(`hand_behind_back ${side}: deepest overlap mm upper ${(worst.upper * 1000).toFixed(0)}, forearm ${(worst.forearm * 1000).toFixed(0)}, hand ${(worst.hand * 1000).toFixed(0)}; smallest gap of the palm behind the back ${(minGap * 1000).toFixed(0)} mm`);
    expect(worst.upper).toBeLessThanOrEqual(LIMIT.upper);
    expect(worst.forearm).toBeLessThanOrEqual(LIMIT.forearm);
    expect(worst.hand).toBeLessThanOrEqual(LIMIT.hand);
  });

  it.each(['right', 'left'] as const)('hand behind back, %s side: at the hold the palm is behind the back, at lumbar height, near the midline', (side) => {
    const c = clearanceOf(env, pointsOf[side], endPose(hbb), side);
    expect(c.backGap).toBeGreaterThan(0.01); // behind the back surface
    expect(c.backGap).toBeLessThan(0.1); // and close to it (not floating far away)
    expect(c.handCentre[1]).toBeGreaterThan(0.95);
    expect(c.handCentre[1]).toBeLessThan(1.2);
    expect(Math.abs(c.handCentre[0])).toBeLessThan(0.15);
    const elbow = apply(armTransforms(endPose(hbb), rigFor(side)).forearm, rigFor(side).pivots.elbow);
    expect(elbow[2]).toBeLessThan(-0.1); // the elbow is behind the body plane, so the forearm crosses behind the trunk
  });

  it('all six movements, both sides: the overlap with the trunk is reported (limits apply to the ones that meet them)', () => {
    for (const m of MOVEMENTS) {
      for (const side of ['right', 'left'] as const) {
        let worst = { upper: 0, forearm: 0, hand: 0 };
        for (let i = 0; i <= 120; i++) {
          const c = clearanceOf(env, pointsOf[side], poseAt(m, i / 120), side);
          worst = { upper: Math.max(worst.upper, c.upper), forearm: Math.max(worst.forearm, c.forearm), hand: Math.max(worst.hand, c.hand) };
        }
        table.push(`${m.id} ${side}: deepest overlap mm upper ${(worst.upper * 1000).toFixed(0)}, forearm ${(worst.forearm * 1000).toFixed(0)}, hand ${(worst.hand * 1000).toFixed(0)}`);
        // a sanity bound for every movement: nothing goes more than 6 cm into the trunk
        expect(Math.max(worst.upper, worst.forearm, worst.hand)).toBeLessThan(0.06);
      }
    }
  });

  afterAll(() => console.log('CLEARANCE (millimetres inside the trunk envelope; limits upper 20, forearm 12, hand 15)\n' + table.join('\n')));
});
