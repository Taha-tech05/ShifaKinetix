// Shared loaders for the READ-ONLY model audit. Nothing here writes to assets/models.
// Original: assets/models/model.glb (world transforms baked, same as build-model-pack.mjs).
// Lite:     assets/models/pack/body-lite.{json,bin} (dequantized back to world space).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const repo = path.join(root, '..');
export const GLB = path.join(root, 'assets', 'models', 'model.glb');
export const LITE_JSON = path.join(root, 'assets', 'models', 'pack', 'body-lite.json');
export const LITE_BIN = path.join(root, 'assets', 'models', 'pack', 'body-lite.bin');
export const OUT = path.join(repo, 'docs', 'model-audit');
const K = 1 / 32767;

export async function loadOriginal() {
  const b = fs.readFileSync(GLB);
  const gltf = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const meshes = [];
  const v = new THREE.Vector3();
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    const pos = g.attributes.position.array;
    const n = g.attributes.position.count;
    const P = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(o.matrixWorld);
      P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
    }
    const c = o.material.color;
    meshes.push({ name: o.name, mat: o.material.name, color: [c.r, c.g, c.b], pos: P, idx: Uint32Array.from(g.index.array) });
  });
  return meshes;
}

/** Lite meshes with world-space positions and a local index list per mesh (as the picker sees them). */
export function loadLite() {
  const meta = JSON.parse(fs.readFileSync(LITE_JSON, 'utf8'));
  const buf = fs.readFileSync(LITE_BIN);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const meshes = [];
  const parts = [];
  for (const p of meta.parts) {
    const Q = new Int16Array(ab, p.pos, p.vCount * 3);
    const I = new Uint32Array(ab, p.idx, p.iCount);
    const part = { key: p.key, layer: p.layer, region: p.region, center: p.center, half: p.half, Q, I, meshNames: [], triStart: [], triCount: [], bounds: [] };
    for (const e of p.meshes) {
      const [name, vStart, vCount, triStart, triCount] = e;
      part.meshNames.push(name); part.triStart.push(triStart); part.triCount.push(triCount); part.bounds.push(e.slice(5));
      const world = new Float32Array(vCount * 3);
      for (let i = 0; i < vCount; i++) for (let a = 0; a < 3; a++) world[i * 3 + a] = Q[(vStart + i) * 3 + a] * K * p.half[a] + p.center[a];
      const idx = new Uint32Array(triCount * 3);
      for (let i = 0; i < triCount * 3; i++) idx[i] = I[triStart * 3 + i] - vStart;
      meshes.push({ name, partKey: p.key, layer: p.layer, region: p.region, pos: world, idx });
    }
    parts.push(part);
  }
  return { meta, meshes, parts };
}

// Mirror of src/screens/model3d/meshNameUtils.ts (pure string logic) so audit can run in plain node.
function strip(name) {
  let n = name;
  n = n.replace(/_?Generated_Mesh_From_X3D\d+/gi, '');
  n = n.replace(/_(Cube|Cone|Plane|Cylinder|BezierCurve|Sphere|Circle)\d+/gi, '');
  n = n.replace(/_[12]$/, '');
  n = n.replace(/_?0*\d{2,3}$/, '');
  return n;
}
function side(name) {
  let m = name.match(/^(.*)_([lr])$/i);
  if (m) return { base: m[1], side: m[2].toLowerCase() === 'l' ? 'Left' : 'Right' };
  m = name.match(/^(.*[a-z])([lr])$/);
  if (m && m[1].length >= 3) return { base: m[1], side: m[2] === 'l' ? 'Left' : 'Right' };
  return { base: name, side: null };
}
/** Structure label: one entry per anatomical structure and side (sub-meshes _1/_2 merge). */
export function structureOf(rawName) {
  const { base, side: s } = side(strip(rawName));
  const title = base.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return s ? `${title} (${s})` : title;
}

export function bbox(pos) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { const x = pos[i + a]; if (x < lo[a]) lo[a] = x; if (x > hi[a]) hi[a] = x; }
  return { lo, hi, size: hi.map((h, a) => h - lo[a]) };
}

export function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function writeCsv(file, rows, cols) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n');
}

// Seeded RNG so every run uses the same rays.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
