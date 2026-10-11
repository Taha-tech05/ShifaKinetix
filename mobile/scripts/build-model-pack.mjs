// Offline build: assets/models/model.glb -> merged "pack" (one draw call per layer+region part).
// Originals are never modified. Usage:
//   node scripts/build-model-pack.mjs full   -> assets/models/pack/body-full.{bin,json}  (no decimation)
//   node scripts/build-model-pack.mjs lite   -> assets/models/pack/body-lite.{bin,json}  (moderate decimation)
//
// Layers (render-only heuristic, NOT anatomical truth; Person A should review):
//   bone        = materials Bone, Cartilage*, Teeth, Suture
//   superficial = soft tissue with a free horizontal straight path to the outside from >= EXPOSED_FRACTION (0.5) of sampled vertices
//   deep        = other soft tissue (hidden under other meshes on every axis)
//   skin        = none: the source model contains no skin mesh, so this layer is empty.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptSimplifier } from 'meshoptimizer';

const mode = process.argv[2] || 'full';
if (!['full', 'lite'].includes(mode)) throw new Error('mode must be full or lite');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'assets', 'models', 'model.glb');
const OUT = path.join(root, 'assets', 'models', 'pack');
const regionMap = JSON.parse(fs.readFileSync(path.join(root, '_web_reference', 'regionMap.json'), 'utf8'));

const BONE_MATERIALS = new Set(['Bone', 'Cartilage', 'Cartilage.001', 'Cartilage.002', 'Teeth', 'Suture']);
const VOXEL = 0.02;
const SAMPLES = 300;
const EXPOSED_FRACTION = Number(process.env.EXPOSED_FRACTION || 0.5);

// Decimation policy (lite only). Rotator cuff gets a gentler ratio and a tighter error bound.
const ROTATOR_CUFF = /^(Supraspinatus|Infraspinatus|Teres_minor|Subscapularis)/i;
const KEEP_BELOW_TRIS = 600;
const RATIO = { rotator: 0.6, bone: 0.25, other: 0.2 };
const ERROR = { rotator: 0.004, normal: 0.02 };

await MeshoptSimplifier.ready;

// ---------- load + bake world transforms ----------
const b = fs.readFileSync(SRC);
const gltf = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
gltf.scene.updateMatrixWorld(true);

const prims = [];
gltf.scene.traverse((o) => {
  if (!o.isMesh) return;
  const g = o.geometry;
  const pos = g.attributes.position.array;
  const nor = g.attributes.normal.array;
  const idx = g.index.array;
  const n = g.attributes.position.count;
  const P = new Float32Array(n * 3);
  const N = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
  for (let i = 0; i < n; i++) {
    v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(o.matrixWorld);
    P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
    v.set(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]).applyMatrix3(nm).normalize();
    N[i * 3] = v.x; N[i * 3 + 1] = v.y; N[i * 3 + 2] = v.z;
  }
  const c = o.material.color; // linear
  prims.push({
    name: o.name,
    mat: o.material.name,
    color: [c.r, c.g, c.b],
    pos: P,
    nor: N,
    idx: Uint32Array.from(idx),
    trisOriginal: idx.length / 3,
  });
});
console.log(`loaded ${prims.length} meshes, ${prims.reduce((s, p) => s + p.trisOriginal, 0)} triangles`);

// ---------- layer heuristic (on full-resolution geometry) ----------
const bb = new THREE.Box3();
for (const p of prims) for (let i = 0; i < p.pos.length; i += 3) bb.expandByPoint(new THREE.Vector3(p.pos[i], p.pos[i + 1], p.pos[i + 2]));
const dims = bb.getSize(new THREE.Vector3()).divideScalar(VOXEL).ceil().addScalar(3);
const NX = dims.x, NY = dims.y, NZ = dims.z;
const owner = new Int32Array(NX * NY * NZ).fill(-1);
const mixed = new Uint8Array(NX * NY * NZ);
const cell = (x, y, z) => [
  Math.floor((x - bb.min.x) / VOXEL) + 1,
  Math.floor((y - bb.min.y) / VOXEL) + 1,
  Math.floor((z - bb.min.z) / VOXEL) + 1,
];
const at = (ix, iy, iz) => (iz * NY + iy) * NX + ix;
prims.forEach((p, id) => {
  for (let i = 0; i < p.pos.length; i += 3) {
    const [ix, iy, iz] = cell(p.pos[i], p.pos[i + 1], p.pos[i + 2]);
    const k = at(ix, iy, iz);
    if (owner[k] === -1) owner[k] = id;
    else if (owner[k] !== id) mixed[k] = 1;
  }
});
// Horizontal rays only (+-x, +-z): vertical rays escape along limbs and overrate exposure.
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
function exposed(id, ix, iy, iz) {
  for (const [dx, dy, dz] of DIRS) {
    let x = ix + dx * 2, y = iy + dy * 2, z = iz + dz * 2, free = true;
    while (x >= 0 && y >= 0 && z >= 0 && x < NX && y < NY && z < NZ) {
      const k = at(x, y, z);
      if (owner[k] !== -1 && (owner[k] !== id || mixed[k])) { free = false; break; }
      x += dx; y += dy; z += dz;
    }
    if (free) return true;
  }
  return false;
}
for (let id = 0; id < prims.length; id++) {
  const p = prims[id];
  if (BONE_MATERIALS.has(p.mat)) { p.layer = 'bone'; continue; }
  const n = p.pos.length / 3;
  const step = Math.max(1, Math.floor(n / SAMPLES));
  let hit = 0, tot = 0;
  for (let i = 0; i < n; i += step) {
    const [ix, iy, iz] = cell(p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]);
    tot++;
    if (exposed(id, ix, iy, iz)) hit++;
  }
  p.exposure = hit / tot;
  p.layer = p.exposure >= EXPOSED_FRACTION ? 'superficial' : 'deep';
}

if (process.env.DEBUG_NAMES) {
  const want = /^(Deltoid|Acromial_part|Pectoralis_major|Trapezius|Latissimus|Rectus_abdominis|Gluteus_maximus|Biceps_brachii|Supraspinatus|Infraspinatus|Subscapularis|Teres_minor|Serratus_anterior|Psoas|Multifidus|Internal_|Pectoralis_minor|Rhomboid|Levator_scapulae|Iliacus|Transversus|Gluteus_minimus|Brachialis)/i;
  for (const p of prims) if (want.test(p.name) && /[lr]_(Gener|Cube|Plane|Cone|grp)|[lr]$/.test(p.name)) console.log(p.layer.padEnd(11), (p.exposure ?? '').toString().slice(0, 4), p.name.slice(0, 50));
}
// ---------- optional decimation ----------
const report = { rotatorCuff: [], decimated: 0, kept: 0 };
for (const p of prims) {
  p.region = regionMap[p.name] || 'unmapped';
  if (mode === 'full') continue;
  const rotator = ROTATOR_CUFF.test(p.name);
  const tris = p.idx.length / 3;
  if (tris > KEEP_BELOW_TRIS) {
    const ratio = rotator ? RATIO.rotator : p.mat === 'Bone' ? RATIO.bone : RATIO.other;
    const target = Math.max(KEEP_BELOW_TRIS, Math.floor(tris * ratio)) * 3;
    const [ni, err] = MeshoptSimplifier.simplify(p.idx, p.pos, 3, target, rotator ? ERROR.rotator : ERROR.normal, ['LockBorder']);
    p.idx = Uint32Array.from(ni);
    p.err = err;
    report.decimated++;
  } else report.kept++;
  if (rotator) report.rotatorCuff.push({ name: p.name, before: tris, after: p.idx.length / 3, error: p.err ?? 0 });
}

// ---------- compact + merge per (layer, region) ----------
const groups = new Map();
for (const p of prims) {
  // drop unused vertices
  const remap = new Int32Array(p.pos.length / 3).fill(-1);
  let nv = 0;
  for (let i = 0; i < p.idx.length; i++) if (remap[p.idx[i]] === -1) remap[p.idx[i]] = nv++;
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3);
  for (let o = 0; o < remap.length; o++) {
    const r = remap[o];
    if (r === -1) continue;
    P.set(p.pos.subarray(o * 3, o * 3 + 3), r * 3);
    N.set(p.nor.subarray(o * 3, o * 3 + 3), r * 3);
  }
  const I = new Uint32Array(p.idx.length);
  for (let i = 0; i < I.length; i++) I[i] = remap[p.idx[i]];
  p.pos = P; p.nor = N; p.idx = I; p.nv = nv;
  const key = `${p.layer}|${p.region}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(p);
}

const pad4 = (n) => (n + 3) & ~3;
const chunks = [];
let offset = 0;
const push = (buf) => {
  const start = offset;
  chunks.push(buf);
  offset += buf.length;
  const padLen = pad4(offset) - offset;
  if (padLen) { chunks.push(Buffer.alloc(padLen)); offset += padLen; }
  return start;
};

const parts = [];
const stats = { triangles: 0, vertices: 0, byLayer: {}, byLayerParts: {} };
for (const [key, list] of groups) {
  const [layer, region] = key.split('|');
  const nv = list.reduce((s, p) => s + p.nv, 0);
  const ni = list.reduce((s, p) => s + p.idx.length, 0);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of list) for (let i = 0; i < p.pos.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p.pos[i + a]); hi[a] = Math.max(hi[a], p.pos[i + a]); }
  const center = lo.map((v, a) => (v + hi[a]) / 2);
  const half = lo.map((v, a) => Math.max((hi[a] - v) / 2, 1e-6));
  const Q = new Int16Array(nv * 3), NRM = new Int8Array(nv * 3), COL = new Uint8Array(nv * 3), IDX = new Uint32Array(ni);
  const meshes = [];
  let vo = 0, io = 0;
  for (const p of list) {
    for (let i = 0; i < p.nv; i++) {
      for (let a = 0; a < 3; a++) {
        Q[(vo + i) * 3 + a] = Math.round(((p.pos[i * 3 + a] - center[a]) / half[a]) * 32767);
        NRM[(vo + i) * 3 + a] = Math.round(p.nor[i * 3 + a] * 127);
        COL[(vo + i) * 3 + a] = Math.round(Math.min(1, p.color[a]) * 255);
      }
    }
    for (let i = 0; i < p.idx.length; i++) IDX[io + i] = p.idx[i] + vo;
    // per-mesh AABB in the part's normalized [-1, 1] space, so the app can skip meshes a tap ray misses
    const bmin = [Infinity, Infinity, Infinity], bmax = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.nv * 3; i++) {
      const a = i % 3, q = Q[vo * 3 + i] / 32767;
      if (q < bmin[a]) bmin[a] = q;
      if (q > bmax[a]) bmax[a] = q;
    }
    meshes.push([p.name, vo, p.nv, io / 3, p.idx.length / 3, ...bmin, ...bmax]);
    vo += p.nv; io += p.idx.length;
  }
  const part = {
    key, layer, region, vCount: nv, iCount: ni, center, half, meshes,
    pos: push(Buffer.from(Q.buffer)), nrm: push(Buffer.from(NRM.buffer)), col: push(Buffer.from(COL.buffer)), idx: push(Buffer.from(IDX.buffer)),
  };
  parts.push(part);
  stats.triangles += ni / 3; stats.vertices += nv;
  stats.byLayer[layer] = (stats.byLayer[layer] || 0) + ni / 3;
  stats.byLayerParts[layer] = (stats.byLayerParts[layer] || 0) + 1;
}

fs.mkdirSync(OUT, { recursive: true });
const base = path.join(OUT, `body-${mode}`);
const bin = Buffer.concat(chunks);
fs.writeFileSync(`${base}.bin`, bin);
const meta = {
  version: 1, mode, parts,
  bbox: { min: bb.min.toArray(), max: bb.max.toArray() },
  stats: { ...stats, drawCalls: parts.length, meshCount: prims.length, bytes: bin.length },
  note: 'layer is a render-only exposure heuristic; skin layer empty (source has no skin mesh)',
};
fs.writeFileSync(`${base}.json`, JSON.stringify(meta));

const exposureHist = prims.filter((p) => p.exposure !== undefined).reduce((h, p) => { const k = Math.min(9, Math.floor(p.exposure * 10)); h[k] = (h[k] || 0) + 1; return h; }, {});
console.log(`\n[${mode}] wrote ${base}.bin (${(bin.length / 1048576).toFixed(1)} MB) + .json`);
console.log(`triangles ${stats.triangles}, vertices ${stats.vertices}, draw calls (parts) ${parts.length}`);
console.log('by layer (tris):', stats.byLayer, 'parts:', stats.byLayerParts);
console.log('exposure histogram (tenths):', exposureHist);
if (mode === 'lite') {
  console.log(`decimated ${report.decimated}, kept as-is ${report.kept}`);
  console.table(report.rotatorCuff);
}
