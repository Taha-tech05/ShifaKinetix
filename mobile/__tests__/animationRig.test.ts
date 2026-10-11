import * as fs from 'fs';
import * as path from 'path';
import rigFile from '../src/data/arm_rig.json';
import { MOVEMENTS, scapulaFor } from '../src/movement/movements';
import { poseAt } from '../src/movement/pose';
import type { Pose } from '../src/movement/pose';
import { ARM_RIG, apply, applyDir, armAxes, armTransforms, arrowDirection, jointPositions, lengthOf, rotation, sub3 } from '../src/movement/rig';
import type { Mat4, Vec3 } from '../src/movement/rig';
import { groupLookup, splitIndices } from '../src/movement/split';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const regionMap = require('../../shared/regions_shoulder.json');

const mk = (elevation: number, plane = 0, rot = 0, elbow = 0): Pose => ({ elevation, plane, rotation: rot, elbow, scapula: scapulaFor(elevation) });
const close = (a: Vec3, b: Vec3, tol = 1e-9) => lengthOf(sub3(a, b)) <= tol;
const deg = (rad: number) => (rad * 180) / Math.PI;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unitOf = (a: Vec3): Vec3 => { const l = lengthOf(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const P = ARM_RIG.pivots;

describe('rig data (computed from the mesh)', () => {
  it('has the axes the animation assumes: +y up, +z forward, right arm on -x', () => {
    const ax = rigFile.axes;
    expect(ax.up.direction).toBe('+y');
    expect(ax.forward.direction).toBe('+z');
    expect(ax.patientRight.direction).toBe('-x');
  });

  it('puts the pivots where the bones are (distances in metres)', () => {
    expect(rigFile.pivots.humeralHeadRadius).toBeGreaterThan(0.02);
    expect(rigFile.pivots.humeralHeadRadius).toBeLessThan(0.028);
    expect(rigFile.pivots.humeralHeadFitRms).toBeLessThan(0.003);
    expect(P.headToGlenoid).toBeGreaterThan(0.01);
    expect(P.headToGlenoid).toBeLessThan(0.04);
    expect(lengthOf(sub3(P.elbow, P.humeralHead))).toBeGreaterThan(0.25);
    expect(lengthOf(sub3(P.wrist, P.elbow))).toBeGreaterThan(0.22);
    // the right side is on the negative x side, the sternoclavicular joint is near the midline
    for (const p of [P.humeralHead, P.glenoid, P.elbow, P.wrist]) expect(p[0]).toBeLessThan(-0.1);
    expect(Math.abs(P.sternoclavicular[0])).toBeLessThan(0.05);
  });

  it('every segment has structures, and no structure is in two segments', () => {
    const seen = new Set<string>();
    for (const list of Object.values(ARM_RIG.segments)) {
      expect(list.length).toBeGreaterThan(0);
      for (const n of list) {
        expect(seen.has(n)).toBe(false);
        seen.add(n);
      }
    }
  });

  it('no left-side structure and none of the trunk muscles is in a moving segment', () => {
    const moving = new Set(Object.values(ARM_RIG.segments).flat());
    const left = Object.values(regionMap.structures as Record<string, { side: string; meshNames: string[] }>).filter((s) => s.side === 'left');
    expect(left.length).toBeGreaterThan(20);
    for (const s of left) for (const n of s.meshNames) expect(moving.has(n)).toBe(false);
    const groupOf = groupLookup(ARM_RIG);
    const trunkLabels = new Set((rigFile.placed as { label: string; seg: string }[]).filter((p) => p.seg === 'trunk').map((p) => p.label));
    expect(trunkLabels.size).toBeGreaterThan(10);
    for (const s of Object.values(regionMap.structures as Record<string, { label: string; meshNames: string[] }>)) {
      if (trunkLabels.has(s.label)) for (const n of s.meshNames) expect(groupOf(n)).toBe('trunk');
    }
  });
});

describe('segment transforms', () => {
  it('has no transform for the trunk: it never moves', () => {
    expect(Object.keys(armTransforms(mk(90))).sort()).toEqual(['forearm', 'girdle', 'upper']);
    expect(groupLookup(ARM_RIG)('Some_other_structure_Generated_Mesh_From_X3D1_1')).toBe('trunk');
  });

  it('rotating the upper arm about the humeral head leaves the pivot where it is', () => {
    for (const [e, plane, rot, elbow] of [[20, 0, 0, 0], [25, 90, 20, 0], [30, 30, -45, 90], [15, 0, 20, 90], [0, 0, 0, 90], [-20, 0, -70, 100]] as const) {
      const t = armTransforms(mk(e, plane, rot, elbow));
      // elevation up to 30 degrees: the girdle does not move, so the head stays exactly where it is
      expect(close(apply(t.upper, P.humeralHead), P.humeralHead)).toBe(true);
    }
  });

  it('above 30 degrees the head moves only with the girdle (the scapula rule), not by the arm rotation', () => {
    for (const [e, plane, rot, elbow] of [[60, 0, 0, 0], [90, 30, 0, 0], [120, 90, 20, 0], [120, 0, 25, 45]] as const) {
      const t = armTransforms(mk(e, plane, rot, elbow));
      expect(close(apply(t.upper, P.humeralHead), apply(t.girdle, P.humeralHead))).toBe(true);
    }
  });

  it('the shoulder girdle moves only through the scapula rule', () => {
    for (const e of [-30, 0, 15, 30]) {
      const t = armTransforms(mk(e, 45, 30, 60));
      expect(t.girdle).toEqual(IDENTITY); // no elevation above 30: no girdle motion, whatever else the arm does
    }
    const ax = armAxes();
    // a vector perpendicular to the girdle axis turns by exactly the scapula angle about the sternoclavicular joint
    const v = unitOf(cross(ax.scapularAxis, [0, 1, 0]));
    for (const e of [45, 90, 120]) {
      const t = armTransforms(mk(e));
      const turned = unitOf(applyDir(t.girdle, v));
      const angle = deg(Math.acos(Math.min(1, dot(v, turned))));
      expect(angle).toBeCloseTo(scapulaFor(e), 6);
      expect(close(apply(t.girdle, P.sternoclavicular), P.sternoclavicular)).toBe(true); // the pivot stays
    }
    // positive = upward rotation: the glenoid rises
    expect(apply(armTransforms(mk(120)).girdle, P.glenoid)[1]).toBeGreaterThan(P.glenoid[1]);
  });

  it('the forearm follows the upper arm', () => {
    for (const e of [0, 45, 90, 120]) {
      const straight = armTransforms(mk(e, 0, 10, 0));
      expect(straight.forearm).toEqual(straight.upper); // elbow straight: one rigid arm
      const bent = armTransforms(mk(e, 0, 10, 90));
      expect(close(apply(bent.forearm, P.elbow), apply(bent.upper, P.elbow))).toBe(true); // the elbow rides on the upper arm
    }
    // the elbow turns the forearm by exactly the elbow angle, relative to the upper arm
    const ax = armAxes();
    const v = unitOf(cross(ax.elbowAxis, [0, 1, 0]));
    const t = armTransforms(mk(60, 20, 15, 70));
    const rel = unitOf(applyDir(t.forearm, v));
    const upperOnly = unitOf(applyDir(t.upper, v));
    expect(deg(Math.acos(Math.min(1, dot(rel, upperOnly))))).toBeCloseTo(70, 5);
  });

  it('uses the sign conventions in the data: elevation up and out, plane forward, rotation outward, elbow forward', () => {
    const wristAt = (p: Pose) => apply(armTransforms(p).forearm, P.wrist);
    const rest = wristAt(mk(0));
    // side raise: the arm goes up and out (-x)
    const side = wristAt(mk(90, 0));
    expect(side[1]).toBeGreaterThan(rest[1] + 0.3);
    expect(side[0]).toBeLessThan(rest[0] - 0.1);
    // forward raise: the arm goes forward (+z)
    expect(wristAt(mk(90, 90))[2]).toBeGreaterThan(rest[2] + 0.2);
    // negative elevation in the forward plane (90): the arm goes backward (-z)
    expect(wristAt(mk(-30, 90))[2]).toBeLessThan(rest[2] - 0.05);
    // elbow flexion: the forearm swings forward
    const bent = armTransforms(mk(0, 0, 0, 90));
    expect(apply(bent.forearm, P.wrist)[2]).toBeGreaterThan(P.elbow[2] + 0.15);
    // external rotation with the elbow bent: the hand swings outward (-x)
    const hand0 = apply(armTransforms(mk(0, 0, 0, 90)).forearm, P.wrist);
    const hand20 = apply(armTransforms(mk(0, 0, 20, 90)).forearm, P.wrist);
    expect(hand20[0]).toBeLessThan(hand0[0] - 0.03);
    // the can position (plane 30) is between the side and forward planes
    const can = wristAt(mk(90, 30));
    expect(can[0]).toBeLessThan(rest[0]);
    expect(can[2]).toBeGreaterThan(rest[2]);
  });

  it('resist arrows have fixed directions', () => {
    expect(arrowDirection('down')).toEqual([0, -1, 0]);
    expect(arrowDirection('inward')[0]).toBeGreaterThan(0); // towards the midline for the right arm
    expect(arrowDirection('toward trunk')[2]).toBeLessThan(0);
  });
});

describe('joint gap', () => {
  const tolerance = 0.001; // 1 mm

  it('the humeral head stays on the glenoid in every frame of every movement (fixture: rig pivots)', () => {
    const rest = lengthOf(sub3(P.humeralHead, P.glenoid));
    let worst = 0;
    for (const m of MOVEMENTS) {
      const n = Math.round(m.loopSeconds * 60);
      for (let i = 0; i <= n; i++) {
        const j = jointPositions(poseAt(m, i / n));
        const gap = lengthOf(sub3(j.humeralHead, j.glenoid));
        worst = Math.max(worst, Math.abs(gap - rest));
      }
    }
    console.log(`JOINT GAP: head to glenoid at rest ${(rest * 1000).toFixed(1)} mm; largest change over all movements ${(worst * 1000).toFixed(6)} mm (tolerance ${tolerance * 1000} mm)`);
    expect(worst).toBeLessThan(tolerance);
  });

  it('the elbow stays on the upper arm and the wrist keeps the forearm length', () => {
    const forearm = lengthOf(sub3(P.wrist, P.elbow));
    for (const m of MOVEMENTS) {
      const n = Math.round(m.loopSeconds * 60);
      for (let i = 0; i <= n; i += 5) {
        const pose = poseAt(m, i / n);
        const t = armTransforms(pose);
        const j = jointPositions(pose);
        expect(close(apply(t.upper, P.elbow), j.elbow, 1e-9)).toBe(true);
        expect(Math.abs(lengthOf(sub3(j.wrist, j.elbow)) - forearm)).toBeLessThan(1e-9);
      }
    }
  });

  it('rotations are rigid: lengths are preserved', () => {
    const m = rotation([0.3, 0.5, 0.8], 1.234);
    const a: Vec3 = [0.1, -0.2, 0.3], b: Vec3 = [-0.4, 0.2, 0.9];
    expect(lengthOf(sub3(apply(m, a), apply(m, b)))).toBeCloseTo(lengthOf(sub3(a, b)), 12);
  });
});

describe('splitting a merged part by index subsets', () => {
  // three meshes in one part; mesh "arm_1" moves, "left_1" and "trunk_1" stay
  const input = {
    names: ['trunk_1', 'arm_1', 'left_1', 'arm_2'],
    triStart: [0, 2, 5, 7],
    triCount: [2, 3, 2, 1],
    indices: Uint32Array.from(Array.from({ length: 8 * 3 }, (_, i) => i)),
  };
  const rig = { segments: { girdle: [] as string[], upper: ['arm_1', 'arm_2'], forearm: [] as string[], hand: [] as string[] } };

  it('holds every triangle exactly once, and only the named structures move', () => {
    const pieces = splitIndices(input, groupLookup(rig));
    expect(pieces.reduce((s, p) => s + p.triangles, 0)).toBe(8);
    const all = pieces.flatMap((p) => [...p.index]).sort((a, b) => a - b);
    expect(all).toEqual([...input.indices]);
    const upper = pieces.find((p) => p.group === 'upper')!;
    expect(upper.triangles).toBe(4);
    expect(pieces.find((p) => p.group === 'trunk')!.triangles).toBe(4); // trunk_1 and left_1
  });

  it('puts highlighted structures in their own piece', () => {
    const pieces = splitIndices(input, groupLookup(rig), (n) => n === 'arm_2');
    const hl = pieces.find((p) => p.highlight)!;
    expect(hl.triangles).toBe(1);
    expect(hl.group).toBe('upper');
    expect(pieces.reduce((s, p) => s + p.triangles, 0)).toBe(8);
  });
});

// ---- checks on the real lite pack (skipped with a message when the pack is not in the working copy) ----
const PACK_JSON = path.join(__dirname, '..', 'assets', 'models', 'pack', 'body-lite.json');
const PACK_BIN = path.join(__dirname, '..', 'assets', 'models', 'pack', 'body-lite.bin');
const hasPack = fs.existsSync(PACK_JSON) && fs.existsSync(PACK_BIN);
if (!hasPack) console.warn('animationRig: lite pack not found, the real-pack checks are skipped (the fixture checks above still run).');

(hasPack ? describe : describe.skip)('real lite pack', () => {
  const meta = hasPack ? JSON.parse(fs.readFileSync(PACK_JSON, 'utf8')) : null;
  const buf = hasPack ? fs.readFileSync(PACK_BIN) : null;
  const ab = buf ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : new ArrayBuffer(0);

  it('every structure name in the rig exists in the pack', () => {
    const names = new Set<string>(meta.parts.flatMap((p: { meshes: unknown[][] }) => p.meshes.map((e) => e[0] as string)));
    for (const n of Object.values(ARM_RIG.segments).flat()) expect(names.has(n)).toBe(true);
  });

  it('splitting every part keeps every triangle once, and moves the number of triangles the rig reports', () => {
    const groupOf = groupLookup(ARM_RIG);
    let total = 0, moved = 0;
    for (const p of meta.parts) {
      const idx = new Uint32Array(ab, p.idx, p.iCount);
      const pieces = splitIndices(
        {
          names: p.meshes.map((e: unknown[]) => e[0] as string),
          triStart: p.meshes.map((e: unknown[]) => e[3] as number),
          triCount: p.meshes.map((e: unknown[]) => e[4] as number),
          indices: idx,
        },
        groupOf,
      );
      const n = pieces.reduce((s, x) => s + x.triangles, 0);
      expect(n).toBe(p.iCount / 3);
      total += n;
      moved += pieces.filter((x) => x.group !== 'trunk').reduce((s, x) => s + x.triangles, 0);
    }
    expect(total).toBe(meta.stats.triangles);
    expect(moved).toBe((rigFile.feasibility.cost as { trianglesMoved: number }).trianglesMoved);
  });

  it('real vertices: the glenoid labrum and the humeral head keep their distance in every sampled frame', () => {
    const K = 1 / 32767;
    const vertsOf = (pred: (name: string) => boolean) => {
      const out: Vec3[] = [];
      for (const p of meta.parts) {
        const Q = new Int16Array(ab, p.pos, p.vCount * 3);
        for (const e of p.meshes as unknown[][]) {
          if (!pred(e[0] as string)) continue;
          for (let v = e[1] as number; v < (e[1] as number) + (e[2] as number); v++) out.push([Q[v * 3] * K * p.half[0] + p.center[0], Q[v * 3 + 1] * K * p.half[1] + p.center[1], Q[v * 3 + 2] * K * p.half[2] + p.center[2]]);
        }
      }
      return out;
    };
    const labrum = vertsOf((n) => /^Glenoid_labrumr_/i.test(n));
    expect(labrum.length).toBeGreaterThan(50);
    const rest = labrum.map((v) => lengthOf(sub3(v, P.humeralHead)));
    let worst = 0;
    for (const m of MOVEMENTS) {
      const n = Math.round(m.loopSeconds * 60);
      for (let i = 0; i <= n; i += 6) {
        const t = armTransforms(poseAt(m, i / n));
        const head = apply(t.upper, P.humeralHead); // the head centre, carried by the upper arm
        labrum.forEach((v, k) => { worst = Math.max(worst, Math.abs(lengthOf(sub3(apply(t.girdle, v), head)) - rest[k])); });
      }
    }
    console.log(`REAL VERTICES: largest change of any glenoid labrum vertex to the humeral head centre: ${(worst * 1000).toFixed(6)} mm`);
    expect(worst).toBeLessThan(0.001);
  });
});
