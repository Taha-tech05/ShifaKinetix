// PART 4 helper: for each right rotator-cuff muscle, find camera angles (yaw, pitch as the app defines them) and a point
// from which the LITE picker returns that muscle FIRST. Used to script tap-to-highlight screenshots on the emulator.
// Also reports whether a muscle can be tapped at all with every layer visible (the app's P5 default).
// Usage (from mobile/): node scripts/audit/part4-tappable.mjs
import fs from 'fs';
import path from 'path';
import { OUT, loadLite, rng, root, structureOf } from './lib.mjs';
import { createRequire } from 'module';
import ts from 'typescript';

const src = fs.readFileSync(path.join(root, 'src', 'screens', 'model3d', 'pick.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(mod, mod.exports, createRequire(import.meta.url));
const { pickPack } = mod.exports;

const meta = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'models', 'pack', 'body-lite.json'), 'utf8'));
const buf = fs.readFileSync(path.join(root, 'assets', 'models', 'pack', 'body-lite.bin'));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const K = 32767;
const matrix = (s, t) => ({ elements: [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, t[0], t[1], t[2], 1] });
const parts = meta.parts.map((m) => ({
  mesh: { visible: true, name: m.key, matrixWorld: matrix(m.half, m.center) }, layer: m.layer, region: m.region,
  names: m.meshes.map((e) => e[0]),
  vStart: Int32Array.from(m.meshes, (e) => e[1]), vCount: Int32Array.from(m.meshes, (e) => e[2]),
  triStart: Int32Array.from(m.meshes, (e) => e[3]), triCount: Int32Array.from(m.meshes, (e) => e[4]),
  bounds: Float32Array.from(m.meshes.flatMap((e) => e.slice(5))),
  positions: new Int16Array(ab, m.pos, m.vCount * 3), indices: new Uint32Array(ab, m.idx, m.iCount), originalColors: new Uint8Array(0),
}));
const lite = loadLite();
const rand = rng(99);

const TARGETS = {
  supraspinatus: 'Supraspinatus Muscle (Right)',
  infraspinatus: 'Infraspinatus Muscle (Right)',
  'teres-minor': 'Teres Minor Muscle (Right)',
  subscapularis: 'Subscapular Muscle (Right)',
};
const out = {};
for (const [key, label] of Object.entries(TARGETS)) {
  const meshes = lite.meshes.filter((m) => structureOf(m.name) === label);
  // sample surface points (vertex positions are fine: they lie on the surface)
  const pts = [];
  for (const m of meshes) for (let i = 0; i < 400; i++) { const v = Math.floor(rand() * (m.pos.length / 3)); pts.push([m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]]); }
  const best = { count: 0 };
  let tried = 0, total = 0;
  const bins = new Map();
  const views = [];
  for (let yawDeg = -180; yawDeg < 180; yawDeg += 30) for (const pitchDeg of [-30, 0, 30]) {
    const y = (yawDeg * Math.PI) / 180, p = (pitchDeg * Math.PI) / 180;
    const f = [-Math.cos(p) * Math.sin(y), Math.sin(p), Math.cos(p) * Math.cos(y)]; // from-direction in model frame
    let ok = 0; const okPts = [];
    for (let i = 0; i < pts.length; i += 12) { // a sample of the points is enough
      const q = pts[i];
      const origin = q.map((c, a) => c + f[a] * 3);
      const hits = pickPack(parts, origin, f.map((c) => -c));
      tried++;
      if (hits[0] && structureOf(hits[0].name) === label) { ok++; okPts.push(q); }
    }
    total += ok;
    bins.set(`${yawDeg},${pitchDeg}`, ok);
    if (ok > 0) views.push({ yawDeg, pitchDeg, ok, points: okPts });
    if (ok > best.count) Object.assign(best, { count: ok, yawDeg, pitchDeg, points: okPts });
  }
  // prefer a natural view: pitch near 0 among views with a decent number of successes
  const good = views.filter((v) => v.ok >= Math.max(2, best.count * 0.4)).sort((a, b) => Math.abs(a.pitchDeg) - Math.abs(b.pitchDeg) || b.ok - a.ok)[0];
  if (good) Object.assign(best, { count: good.ok, yawDeg: good.yawDeg, pitchDeg: good.pitchDeg, points: good.points });
  if (best.count > 0) {
    const c = [0, 1, 2].map((a) => best.points.reduce((s, q) => s + q[a], 0) / best.points.length);
    // pick the successful point closest to the mean of successful points (a point certainly on the muscle)
    const pt = best.points.reduce((b, q) => (Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]) < b.d ? { q, d: Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]) } : b), { q: best.points[0], d: Infinity }).q;
    out[key] = { views: views.map((v) => `${v.yawDeg}/${v.pitchDeg}:${v.ok}`), label, sampled: pts.length, rays: tried, firstHitTotal: total, bestYawDeg: best.yawDeg, bestPitchDeg: best.pitchDeg, successInBestView: best.count, point: pt };
  } else out[key] = { views: views.map((v) => `${v.yawDeg}/${v.pitchDeg}:${v.ok}`), label, sampled: pts.length, rays: tried, firstHitTotal: 0, note: 'never the first hit from any tested direction with all layers visible' };
}
fs.writeFileSync(path.join(OUT, 'part4-tappable.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));

// ---- forced natural views and projection to emulator pixels (Pixel 7, P5 canvas rectangle measured from a screenshot) ----
const FORCED = { infraspinatus: [180, 0], 'teres-minor': [180, 0], subscapularis: [30, -30] };
const CANVAS = { left: 53, top: 635, w: 974, h: 1013 }; // px on the 1080x2400 emulator screen
const FOV = 45, DIST = (1 / Math.tan((FOV / 2) * Math.PI / 180)) * 1.25;
const bb = meta.bbox, size = bb.max.map((v, a) => v - bb.min[a]);
const scale = 2 / size[1], ctr = bb.min.map((v, a) => (v + bb.max[a]) / 2);
function project(pt, yawDeg, pitchDeg) {
  const y = (yawDeg * Math.PI) / 180, p = (pitchDeg * Math.PI) / 180;
  const v = pt.map((c, a) => (c - ctr[a]) * scale);
  const ry = [v[0] * Math.cos(y) + v[2] * Math.sin(y), v[1], -v[0] * Math.sin(y) + v[2] * Math.cos(y)];
  const rx = [ry[0], ry[1] * Math.cos(p) - ry[2] * Math.sin(p), ry[1] * Math.sin(p) + ry[2] * Math.cos(p)];
  const th = Math.tan((FOV / 2) * Math.PI / 180), asp = CANVAS.w / CANVAS.h;
  const depth = DIST - rx[2];
  const nx = rx[0] / (depth * th * asp), ny = rx[1] / (depth * th);
  return [Math.round(CANVAS.left + ((nx + 1) / 2) * CANVAS.w), Math.round(CANVAS.top + ((1 - ny) / 2) * CANVAS.h)];
}
const taps = {};
for (const [key, [yawDeg, pitchDeg]] of Object.entries(FORCED)) {
  const label = TARGETS[key];
  const mm = lite.meshes.filter((m) => structureOf(m.name) === label);
  const y = (yawDeg * Math.PI) / 180, p = (pitchDeg * Math.PI) / 180;
  const f = [-Math.cos(p) * Math.sin(y), Math.sin(p), Math.cos(p) * Math.cos(y)];
  const ok = [];
  for (const m of mm) for (let i = 0; i < 600; i++) {
    const v = Math.floor(rand() * (m.pos.length / 3)); const q = [m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]];
    const hits = pickPack(parts, q.map((c, a) => c + f[a] * 3), f.map((c) => -c));
    if (hits[0] && structureOf(hits[0].name) === label) ok.push(q);
  }
  if (!ok.length) { taps[key] = { yawDeg, pitchDeg, note: 'no tappable point found' }; continue; }
  const c = [0, 1, 2].map((a) => ok.reduce((s, q) => s + q[a], 0) / ok.length);
  const pt = ok.reduce((b, q) => { const d = Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]); return d < b.d ? { q, d } : b; }, { q: ok[0], d: Infinity }).q;
  taps[key] = { yawDeg, pitchDeg, successfulPoints: ok.length, point: pt, tapPx: project(pt, yawDeg, pitchDeg), swipePxForYaw: Math.round((yawDeg * Math.PI / 180) / 0.01 * 2.625), swipePxForPitch: Math.round((pitchDeg * Math.PI / 180) / 0.01 * 2.625) };
}
fs.writeFileSync(path.join(OUT, 'part4-taps.json'), JSON.stringify(taps, null, 1));
console.log('TAPS', JSON.stringify(taps, null, 1));
