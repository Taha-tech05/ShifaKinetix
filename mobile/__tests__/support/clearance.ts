// Clearance of the moving arm from the trunk, measured on the real lite pack (used by tests; no three.js).
// The trunk "envelope" is a height map over (x, y) of the smallest and largest z (back and front surface) of every
// structure that never moves. An arm vertex is "inside the trunk" when it lies between those two surfaces; the depth is
// how far from the nearer surface. A small depth is normal where soft tissue meshes overlap a little.
import * as fs from 'fs';
import * as path from 'path';
import type { Pose } from '../../src/movement/pose';
import { apply, armTransforms, rigFor } from '../../src/movement/rig';
import type { Side, Vec3 } from '../../src/movement/rig';

export const PACK_JSON = path.join(__dirname, '..', '..', 'assets', 'models', 'pack', 'body-lite.json');
export const PACK_BIN = path.join(__dirname, '..', '..', 'assets', 'models', 'pack', 'body-lite.bin');
export const hasPack = fs.existsSync(PACK_JSON) && fs.existsSync(PACK_BIN);

export interface MeshPoints {
  name: string;
  pts: Float32Array;
}

export function loadMeshes(): MeshPoints[] {
  const meta = JSON.parse(fs.readFileSync(PACK_JSON, 'utf8'));
  const buf = fs.readFileSync(PACK_BIN);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const K = 1 / 32767;
  const out: MeshPoints[] = [];
  for (const p of meta.parts) {
    const Q = new Int16Array(ab, p.pos, p.vCount * 3);
    for (const e of p.meshes as unknown[][]) {
      const vS = e[1] as number;
      const vC = e[2] as number;
      const pts = new Float32Array(vC * 3);
      for (let i = 0; i < vC; i++) for (let a = 0; a < 3; a++) pts[i * 3 + a] = Q[(vS + i) * 3 + a] * K * p.half[a] + p.center[a];
      out.push({ name: e[0] as string, pts });
    }
  }
  return out;
}

const CELL = 0.02;
const cellKey = (x: number, y: number) => `${Math.round(x / CELL)},${Math.round(y / CELL)}`;

export interface Envelope {
  at(x: number, y: number): { zmin: number; zmax: number } | undefined;
}

/** Back and front surface of everything that does not move (both arms' moving segments are left out). */
export function trunkEnvelope(meshes: MeshPoints[]): Envelope {
  const moving = new Set([...Object.values(rigFor('right').segments).flat(), ...Object.values(rigFor('left').segments).flat()]);
  const grid = new Map<string, { zmin: number; zmax: number }>();
  for (const m of meshes) {
    if (moving.has(m.name)) continue;
    for (let i = 0; i < m.pts.length; i += 3) {
      const x = m.pts[i];
      const y = m.pts[i + 1];
      const z = m.pts[i + 2];
      if (y < 0.7 || y > 1.65) continue;
      const k = cellKey(x, y);
      const g = grid.get(k);
      if (!g) grid.set(k, { zmin: z, zmax: z });
      else {
        g.zmin = Math.min(g.zmin, z);
        g.zmax = Math.max(g.zmax, z);
      }
    }
  }
  return { at: (x, y) => grid.get(cellKey(x, y)) };
}

export interface ArmPoints {
  upper: Vec3[];
  forearm: Vec3[];
  hand: Vec3[];
}

/** Sampled vertices of the moving segments of one side (every `step`-th vertex). */
export function armPoints(meshes: MeshPoints[], side: Side, step = 6): ArmPoints {
  const seg = rigFor(side).segments;
  const take = (names: string[], stride: number): Vec3[] => {
    const set = new Set(names);
    const out: Vec3[] = [];
    for (const m of meshes) {
      if (!set.has(m.name)) continue;
      for (let i = 0; i < m.pts.length; i += 3 * stride) out.push([m.pts[i], m.pts[i + 1], m.pts[i + 2]]);
    }
    return out;
  };
  return { upper: take(seg.upper, step + 2), forearm: take(seg.forearm, step), hand: take(seg.hand, 3) };
}

export interface Clearance {
  /** Deepest vertex inside the trunk, metres, per segment (the upper arm only below the shoulder: y < 1.22). */
  upper: number;
  forearm: number;
  hand: number;
  /** Palm centre (mean of the hand vertices) and how far it is behind the back surface at its height (negative = in front of it). */
  handCentre: Vec3;
  backGap: number;
}

function depthOf(env: Envelope, pts: Vec3[], mat: number[], ymax: number): number {
  let worst = 0;
  for (const q of pts) {
    const p = apply(mat, q);
    if (p[1] > ymax) continue;
    const g = env.at(p[0], p[1]);
    if (!g) continue;
    worst = Math.max(worst, Math.min(p[2] - g.zmin, g.zmax - p[2]));
  }
  return worst;
}

/** Clearance of one side's arm for a pose, against the envelope of everything that does not move (both sides of the trunk). */
export function clearanceOf(env: Envelope, arm: ArmPoints, pose: Pose, side: Side): Clearance {
  const t = armTransforms(pose, rigFor(side));
  const upper = depthOf(env, arm.upper, t.upper, 1.22);
  const forearm = depthOf(env, arm.forearm, t.forearm, 9);
  const hand = depthOf(env, arm.hand, t.forearm, 9);
  const c = [0, 1, 2].map((a) => arm.hand.reduce((s, p) => s + p[a], 0) / arm.hand.length) as Vec3;
  const w = apply(t.forearm, c);
  const g = env.at(w[0], w[1]);
  return { upper, forearm, hand, handCentre: w, backGap: g ? g.zmin - w[2] : Infinity };
}
