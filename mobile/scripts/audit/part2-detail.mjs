// PART 2: per-structure detail loss between model.glb and body-lite (read-only).
// Usage (from mobile/): node scripts/audit/part2-detail.mjs
// Metrics per structure (anatomical name + side; sub-meshes _1/_2 are pooled):
//   triangles kept, bounding-box change, surface-to-surface shape error (original -> lite), area and volume change.
// Shape error: SAMPLES random points on the ORIGINAL surface (area-weighted); distance to the nearest point on the
// LITE surface of the same structure. One-directional (original -> lite), so holes or missing parts of lite show up,
// but extra lite geometry that is not in the original would not. Reported as % of the structure's longest dimension.
import path from 'path';
import { OUT, loadLite, loadOriginal, rng, structureOf, writeCsv } from './lib.mjs';

const SAMPLES_PER_MESH = 200;
const rand = rng(12345);

// ---- geometry helpers ----
// Bounding box over vertices that triangles actually use (the pack drops unreferenced vertices).
function bbox(pos, idx) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < idx.length; i++) for (let a = 0; a < 3; a++) { const x = pos[idx[i] * 3 + a]; if (x < lo[a]) lo[a] = x; if (x > hi[a]) hi[a] = x; }
  return { lo, hi, size: hi.map((h, a) => h - lo[a]) };
}
function triArea(pos, a, b, c) {
  const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
  const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  return 0.5 * Math.hypot(cx, cy, cz);
}
function areaAndVolume(pos, idx) {
  let area = 0, vol = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    area += triArea(pos, a, b, c);
    vol += (pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c]) + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c])) / 6;
  }
  return { area, vol: Math.abs(vol) };
}
function sampleSurface(pos, idx, n) {
  const nt = idx.length / 3;
  const cum = new Float64Array(nt);
  let tot = 0;
  for (let t = 0; t < nt; t++) { tot += triArea(pos, idx[t * 3] * 3, idx[t * 3 + 1] * 3, idx[t * 3 + 2] * 3); cum[t] = tot; }
  const out = new Float32Array(n * 3);
  if (tot === 0) return out;
  for (let i = 0; i < n; i++) {
    const r = rand() * tot;
    let lo = 0, hi = nt - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
    const a = idx[lo * 3] * 3, b = idx[lo * 3 + 1] * 3, c = idx[lo * 3 + 2] * 3;
    let u = rand(), v = rand();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    for (let k = 0; k < 3; k++) out[i * 3 + k] = pos[a + k] + u * (pos[b + k] - pos[a + k]) + v * (pos[c + k] - pos[a + k]);
  }
  return out;
}
// squared distance from point p to triangle (a,b,c) (Ericson, Real-Time Collision Detection)
function distSqPointTri(px, py, pz, pos, a, b, c) {
  const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
  const abx = pos[b] - ax, aby = pos[b + 1] - ay, abz = pos[b + 2] - az;
  const acx = pos[c] - ax, acy = pos[c + 1] - ay, acz = pos[c + 2] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let x, y, z;
  if (d1 <= 0 && d2 <= 0) { x = ax; y = ay; z = az; }
  else {
    const bpx = px - pos[b], bpy = py - pos[b + 1], bpz = pz - pos[b + 2];
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { x = pos[b]; y = pos[b + 1]; z = pos[b + 2]; }
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); x = ax + v * abx; y = ay + v * aby; z = az + v * abz; }
      else {
        const cpx = px - pos[c], cpy = py - pos[c + 1], cpz = pz - pos[c + 2];
        const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) { x = pos[c]; y = pos[c + 1]; z = pos[c + 2]; }
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); x = ax + w * acx; y = ay + w * acy; z = az + w * acz; }
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); x = pos[b] + w * (pos[c] - pos[b]); y = pos[b + 1] + w * (pos[c + 1] - pos[b + 1]); z = pos[b + 2] + w * (pos[c + 2] - pos[b + 2]); }
            else { const den = 1 / (va + vb + vc); const v = vb * den, w = vc * den; x = ax + abx * v + acx * w; y = ay + aby * v + acy * w; z = az + abz * v + acz * w; }
          }
        }
      }
    }
  }
  const dx = px - x, dy = py - y, dz = pz - z;
  return dx * dx + dy * dy + dz * dz;
}
/** Nearest-distance evaluator over a set of triangles with per-triangle AABB pruning. */
function makeNearest(pos, idx) {
  const nt = idx.length / 3;
  const box = new Float32Array(nt * 6);
  for (let t = 0; t < nt; t++) {
    for (let k = 0; k < 3; k++) {
      const v0 = pos[idx[t * 3] * 3 + k], v1 = pos[idx[t * 3 + 1] * 3 + k], v2 = pos[idx[t * 3 + 2] * 3 + k];
      box[t * 6 + k] = Math.min(v0, v1, v2); box[t * 6 + 3 + k] = Math.max(v0, v1, v2);
    }
  }
  return (px, py, pz) => {
    let best = Infinity;
    for (let t = 0; t < nt; t++) {
      const o = t * 6;
      const dx = Math.max(box[o] - px, 0, px - box[o + 3]), dy = Math.max(box[o + 1] - py, 0, py - box[o + 4]), dz = Math.max(box[o + 2] - pz, 0, pz - box[o + 5]);
      if (dx * dx + dy * dy + dz * dz >= best) continue;
      const d = distSqPointTri(px, py, pz, pos, idx[t * 3] * 3, idx[t * 3 + 1] * 3, idx[t * 3 + 2] * 3);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };
}

// ---- load and group ----
const orig = await loadOriginal();
const lite = loadLite();
const liteByName = new Map(lite.meshes.map((m) => [m.name, m]));
const layerOf = new Map(lite.meshes.map((m) => [m.name, m.layer]));

const groups = new Map(); // structure -> { orig: [], lite: [] }
for (const m of orig) {
  const key = structureOf(m.name);
  if (!groups.has(key)) groups.set(key, { orig: [], lite: [] });
  groups.get(key).orig.push(m);
  const l = liteByName.get(m.name);
  if (l) groups.get(key).lite.push(l);
}

function pool(list) {
  // concatenate meshes into one position array / index array
  let nv = 0, ni = 0;
  for (const m of list) { nv += m.pos.length; ni += m.idx.length; }
  const pos = new Float32Array(nv), idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const m of list) {
    pos.set(m.pos, vo);
    for (let i = 0; i < m.idx.length; i++) idx[io + i] = m.idx[i] + vo / 3;
    vo += m.pos.length; io += m.idx.length;
  }
  return { pos, idx };
}

const rows = [];
let done = 0;
const t0 = Date.now();
for (const [name, g] of groups) {
  const o = pool(g.orig), l = pool(g.lite);
  const ob = bbox(o.pos, o.idx), lb = bbox(l.pos, l.idx);
  const longest = Math.max(...ob.size);
  const oAv = areaAndVolume(o.pos, o.idx), lAv = areaAndVolume(l.pos, l.idx);
  const nearest = makeNearest(l.pos, l.idx);
  // sample per mesh so tiny sub-meshes are not drowned out by big ones
  let sum = 0, max = 0, cnt = 0;
  for (const m of g.orig) {
    const S = sampleSurface(m.pos, m.idx, SAMPLES_PER_MESH);
    for (let i = 0; i < S.length; i += 3) {
      const d = nearest(S[i], S[i + 1], S[i + 2]);
      sum += d; cnt++; if (d > max) max = d;
    }
  }
  const origTris = o.idx.length / 3, liteTris = l.idx.length / 3;
  // bbox change relative to the longest dimension of the original (avoids huge % on near-flat axes)
  const bboxChange = Math.max(...ob.size.map((s, a) => Math.abs(lb.size[a] - s))) / longest * 100;
  const sizeChangeAxis = ob.size.map((s, a) => (s > 0 ? (lb.size[a] - s) / s * 100 : 0));
  const meanErr = cnt ? (sum / cnt) / longest * 100 : 0;
  const maxErr = (max / longest) * 100;
  const keptPct = (liteTris / origTris) * 100;
  const category = [...new Set(g.orig.map((m) => layerOf.get(m.name)))].join('+');
  const flags = [];
  let status = 'PASS';
  if (liteTris < 50) { status = 'FAIL'; flags.push(`lite<50 tris${origTris < 50 ? ' (original also <50: no loss)' : ''}`); }
  if (bboxChange > 5) { status = 'FAIL'; flags.push('bbox>5%'); }
  if (status !== 'FAIL') {
    if (keptPct < 30) { status = 'WARN'; flags.push('kept<30%'); }
    if (maxErr > 2) { status = 'WARN'; flags.push('maxErr>2%'); }
  } else {
    if (keptPct < 30) flags.push('kept<30%');
    if (maxErr > 2) flags.push('maxErr>2%');
  }
  rows.push({
    structure: name, category, meshes: g.orig.length, lite_meshes: g.lite.length,
    orig_tris: origTris, lite_tris: liteTris, tris_kept_pct: keptPct.toFixed(1),
    orig_dx: ob.size[0].toFixed(4), orig_dy: ob.size[1].toFixed(4), orig_dz: ob.size[2].toFixed(4), longest: longest.toFixed(4),
    lite_dx: lb.size[0].toFixed(4), lite_dy: lb.size[1].toFixed(4), lite_dz: lb.size[2].toFixed(4),
    bbox_change_pct_of_longest: bboxChange.toFixed(3), bbox_axis_change_pct: sizeChangeAxis.map((v) => v.toFixed(2)).join('/'),
    mean_err_pct: meanErr.toFixed(4), max_err_pct: maxErr.toFixed(4), mean_err_mm: (cnt ? (sum / cnt) * 1000 : 0).toFixed(3), max_err_mm: (max * 1000).toFixed(3),
    orig_area: oAv.area.toExponential(4), lite_area: lAv.area.toExponential(4), area_change_pct: ((lAv.area - oAv.area) / oAv.area * 100).toFixed(2),
    orig_volume: oAv.vol.toExponential(4), lite_volume: lAv.vol.toExponential(4), volume_change_pct: oAv.vol > 0 ? ((lAv.vol - oAv.vol) / oAv.vol * 100).toFixed(2) : '',
    status, flags: flags.join('; '),
  });
  if (++done % 100 === 0) console.error(`${done}/${groups.size} structures, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
const cols = Object.keys(rows[0]);
writeCsv(path.join(OUT, 'per-muscle.csv'), rows, cols);
const count = (s) => rows.filter((r) => r.status === s).length;
console.log(`structures ${rows.length}: PASS ${count('PASS')}, WARN ${count('WARN')}, FAIL ${count('FAIL')}; ${((Date.now() - t0) / 1000).toFixed(0)} s`);
