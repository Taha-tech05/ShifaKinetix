// PART 3: picking parity. Runs the app's own picker (src/screens/model3d/pick.ts, transpiled on the fly via the
// compiled copy below) against the original and the lite pack with the same rays.
// Usage (from mobile/): node scripts/audit/part3-picking.mjs
//
// The original has no pack format, so each original mesh becomes one single-mesh "part" quantized to int16 in its own
// bounding box (error <= 1/32767 of the mesh size, far below anything measured here). The lite parts are used exactly as
// the app builds them.
import fs from 'fs';
import path from 'path';
import { OUT, bbox, loadOriginal, rng, structureOf, writeCsv, root } from './lib.mjs';
import { createRequire } from 'module';
import ts from 'typescript';

// Load the real picker source (TypeScript) without copying it.
const src = fs.readFileSync(path.join(root, 'src', 'screens', 'model3d', 'pick.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(mod, mod.exports, createRequire(import.meta.url));
const { pickPack } = mod.exports;

const K = 32767;
const matrix = (s, t) => ({ elements: [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, t[0], t[1], t[2], 1] });

// ---- lite parts, built like loadPack.ts does ----
const meta = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'models', 'pack', 'body-lite.json'), 'utf8'));
const buf = fs.readFileSync(path.join(root, 'assets', 'models', 'pack', 'body-lite.bin'));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const liteParts = meta.parts.map((m) => ({
  mesh: { visible: true, name: m.key, matrixWorld: matrix(m.half, m.center) },
  layer: m.layer, region: m.region,
  names: m.meshes.map((e) => e[0]),
  vStart: Int32Array.from(m.meshes, (e) => e[1]), vCount: Int32Array.from(m.meshes, (e) => e[2]),
  triStart: Int32Array.from(m.meshes, (e) => e[3]), triCount: Int32Array.from(m.meshes, (e) => e[4]),
  bounds: Float32Array.from(m.meshes.flatMap((e) => e.slice(5))),
  positions: new Int16Array(ab, m.pos, m.vCount * 3), indices: new Uint32Array(ab, m.idx, m.iCount),
  originalColors: new Uint8Array(0),
}));

// ---- original as single-mesh parts ----
const orig = await loadOriginal();
const origParts = orig.map((m) => {
  const bb = bbox(m.pos);
  const center = bb.lo.map((l, a) => (l + bb.hi[a]) / 2);
  const half = bb.size.map((s) => Math.max(s / 2, 1e-6));
  const n = m.pos.length / 3;
  const Q = new Int16Array(n * 3);
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) Q[i * 3 + a] = Math.round(((m.pos[i * 3 + a] - center[a]) / half[a]) * K);
  // AABB over referenced vertices in normalized space
  const lo = [1, 1, 1], hi = [-1, -1, -1];
  for (let i = 0; i < m.idx.length; i++) for (let a = 0; a < 3; a++) { const q = Q[m.idx[i] * 3 + a] / K; if (q < lo[a]) lo[a] = q; if (q > hi[a]) hi[a] = q; }
  return {
    mesh: { visible: true, name: m.name, matrixWorld: matrix(half, center) }, layer: 'x', region: 'x', names: [m.name],
    vStart: Int32Array.of(0), vCount: Int32Array.of(n), triStart: Int32Array.of(0), triCount: Int32Array.of(m.idx.length / 3),
    bounds: Float32Array.from([...lo, ...hi]), positions: Q, indices: m.idx, originalColors: new Uint8Array(0),
  };
});

// ---- per-mesh info for reporting ----
const info = new Map();
for (const m of orig) { const b = bbox(m.pos); info.set(m.name, { tris: m.idx.length / 3, longest: Math.max(...b.size), thinnest: Math.min(...b.size), structure: structureOf(m.name) }); }

// ---- rays ----
const rand = rng(777);
const allBox = { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] };
for (const m of orig) { const b = bbox(m.pos); for (let a = 0; a < 3; a++) { allBox.lo[a] = Math.min(allBox.lo[a], b.lo[a]); allBox.hi[a] = Math.max(allBox.hi[a], b.hi[a]); } }
const bodyC = allBox.lo.map((l, a) => (l + allBox.hi[a]) / 2);
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const rays = [];
// 500 random rays: random point on a big sphere, aimed at a random point inside the body box
for (let i = 0; i < 500; i++) {
  const u = rand() * 2 - 1, phi = rand() * Math.PI * 2, r = Math.sqrt(1 - u * u);
  const dir = [r * Math.cos(phi), u, r * Math.sin(phi)];
  const target = allBox.lo.map((l, a) => l + (allBox.hi[a] - l) * (0.2 + 0.6 * rand()));
  const origin = target.map((t, a) => t + dir[a] * 3);
  rays.push({ id: `random-${i}`, group: 'random', origin, direction: norm(target.map((t, a) => t - origin[a])) });
}
// 20 rays at the centre of each shoulder structure: 10 from the front, 10 from the back, within 50 degrees of the axis
const SH = /deltoid|supraspin|infraspin|teres_m|subscap|trapezius|levator_scap|rhomboid|biceps_brachii|triceps_brachii|pectoralis|latissimus|^clavicle|^scapula|^humerus|serratus_anterior|coracobrachialis/i;
const byStruct = new Map();
for (const m of orig) if (SH.test(m.name)) { const s = structureOf(m.name); if (!byStruct.has(s)) byStruct.set(s, []); byStruct.get(s).push(m); }
const shoulderTargets = [];
for (const [s, list] of byStruct) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const m of list) { const b = bbox(m.pos); for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], b.lo[a]); hi[a] = Math.max(hi[a], b.hi[a]); } }
  const c = lo.map((l, a) => (l + hi[a]) / 2);
  shoulderTargets.push(s);
  for (let i = 0; i < 20; i++) {
    const sign = i < 10 ? 1 : -1; // +z front, -z back
    const ang = (rand() * 50 * Math.PI) / 180, az = rand() * Math.PI * 2;
    const dir = [Math.sin(ang) * Math.cos(az), Math.sin(ang) * Math.sin(az), sign * Math.cos(ang)];
    const origin = c.map((x, a) => x + dir[a] * 3);
    rays.push({ id: `${s}#${i}`, group: s, origin, direction: norm(c.map((x, a) => x - origin[a])) });
  }
}

// ---- run ----
function runPicker(parts, ray) {
  const hits = pickPack(parts, ray.origin, ray.direction);
  return hits;
}
let t0 = Date.now();
const results = [];
for (const ray of rays) {
  const o = runPicker(origParts, ray), l = runPicker(liteParts, ray);
  results.push({ ray, o, l });
}
console.error(`picked ${rays.length} rays x2 in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

const rows = [];
for (const { ray, o, l } of results) {
  const on = o[0]?.name ?? '(none)', ln = l[0]?.name ?? '(none)';
  const sameMesh = on === ln;
  const sameStruct = on !== '(none)' && ln !== '(none)' && info.get(on).structure === info.get(ln).structure;
  const anyHit = on === '(none)' && ln === '(none)';
  const inLiteList = on !== '(none)' && l.some((h) => h.name === on);
  rows.push({
    ray: ray.id, group: ray.group === 'random' ? 'random' : 'shoulder', orig_first: on, lite_first: ln,
    orig_dist: o[0] ? o[0].distance.toFixed(5) : '', lite_dist: l[0] ? l[0].distance.toFixed(5) : '',
    same_mesh: sameMesh || anyHit ? 'yes' : 'no', same_structure: sameStruct || anyHit ? 'yes' : 'no',
    orig_first_missing_from_lite_hits: on !== '(none)' && !inLiteList ? 'yes' : 'no',
    orig_hit_count: o.length, lite_hit_count: l.length,
  });
}
writeCsv(path.join(OUT, 'part3-rays.csv'), rows, Object.keys(rows[0]));

const stat = (grp) => {
  const r = rows.filter((x) => grp === 'all' || x.group === grp);
  const n = r.length;
  return {
    rays: n,
    both_hit: r.filter((x) => x.orig_first !== '(none)' && x.lite_first !== '(none)').length,
    no_hit_in_both: r.filter((x) => x.orig_first === '(none)' && x.lite_first === '(none)').length,
    same_mesh: r.filter((x) => x.same_mesh === 'yes').length, same_structure: r.filter((x) => x.same_structure === 'yes').length,
    missed_in_lite: r.filter((x) => x.orig_first_missing_from_lite_hits === 'yes').length,
    hit_in_one_only: r.filter((x) => (x.orig_first === '(none)') !== (x.lite_first === '(none)')).length,
  };
};
const summary = { all: stat('all'), random: stat('random'), shoulder: stat('shoulder'), shoulderTargets: shoulderTargets.length };

// shoulder target hit rate: how often the first hit is the targeted structure
let tOrig = 0, tLite = 0, tN = 0;
for (const { ray, o, l } of results) {
  if (ray.group === 'random') continue;
  tN++;
  if (o[0] && info.get(o[0].name).structure === ray.group) tOrig++;
  if (l[0] && info.get(l[0].name).structure === ray.group) tLite++;
}
summary.shoulderTargetFirstHit = { rays: tN, original: tOrig, lite: tLite };
// Stricter, for thin or covered muscles: is the targeted structure hit ANYWHERE along the ray (not only first)?
let aOrig = 0, aLite = 0, onlyOrig = [], onlyLite = 0;
for (const { ray, o, l } of results) {
  if (ray.group === 'random') continue;
  const inO = o.some((h) => info.get(h.name).structure === ray.group), inL = l.some((h) => info.get(h.name).structure === ray.group);
  if (inO) aOrig++;
  if (inL) aLite++;
  if (inO && !inL) onlyOrig.push(ray.id);
  if (!inO && inL) onlyLite++;
}
summary.shoulderTargetHitAnywhere = { rays: tN, original: aOrig, lite: aLite, hitInOriginalButNotLite: onlyOrig, hitInLiteButNotOriginal: onlyLite };

const dis = rows.filter((x) => x.same_mesh === 'no');
const disTable = dis.map((x) => ({ ...x, orig_struct: info.get(x.orig_first)?.structure ?? '', lite_struct: info.get(x.lite_first)?.structure ?? '', orig_tris: info.get(x.orig_first)?.tris ?? '', orig_longest_m: info.get(x.orig_first)?.longest?.toFixed(4) ?? '', orig_thinnest_m: info.get(x.orig_first)?.thinnest?.toFixed(5) ?? '', dist_diff_mm: x.orig_dist && x.lite_dist ? ((+x.lite_dist - +x.orig_dist) * 1000).toFixed(2) : '' }));
writeCsv(path.join(OUT, 'part3-disagreements.csv'), disTable, disTable[0] ? Object.keys(disTable[0]) : ['none']);
summary.disagreements = disTable.length;
summary.missedSmall = disTable.filter((x) => x.orig_first_missing_from_lite_hits === 'yes').map((x) => ({ ray: x.ray, muscle: x.orig_struct, tris: x.orig_tris, longest_m: x.orig_longest_m, thinnest_m: x.orig_thinnest_m, lite_first: x.lite_struct }));
fs.writeFileSync(path.join(OUT, 'part3-summary.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
console.log('\nDISAGREEMENTS (mesh level):');
for (const d of disTable.slice(0, 60)) console.log(`${d.ray} | orig: ${d.orig_struct || d.orig_first} (${d.orig_dist}) | lite: ${d.lite_struct || d.lite_first} (${d.lite_dist}) | diff ${d.dist_diff_mm} mm | same structure: ${d.same_structure}`);
