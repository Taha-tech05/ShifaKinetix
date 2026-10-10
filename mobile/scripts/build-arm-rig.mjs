// Builds src/data/arm_rig.json: the right-arm rig for the movement animation, computed from the lite pack mesh.
// Reads assets/models/pack/body-lite.{json,bin} (read-only). Nothing in the pack is changed or rebuilt.
//
// What it computes
//  - body axes (which way is forward, up and right) from the mesh,
//  - pivots from the mesh: humeral head centre (sphere fit), glenoid centre (glenoid labrum), elbow, wrist,
//    sternoclavicular joint (medial clavicle end),
//  - the segment of every right-arm structure by explicit name rules (with a reason for each rule).
// Every other structure, and everything on the left side, stays in the trunk and never moves.
//
// Usage (from mobile/): node scripts/build-arm-rig.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.join(root, '..');
const META = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'models', 'pack', 'body-lite.json'), 'utf8'));
const buf = fs.readFileSync(path.join(root, 'assets', 'models', 'pack', 'body-lite.bin'));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const K = 1 / 32767;

// ---- names (mirror of src/screens/model3d/meshNameUtils.ts) ----
const strip = (n) => n.replace(/_?Generated_Mesh_From_X3D\d+/gi, '').replace(/_(Cube|Cone|Plane|Cylinder|BezierCurve|Sphere|Circle)\d+/gi, '').replace(/_[12]$/, '').replace(/_?0*\d{2,3}$/, '');
function structureLabel(raw) {
  const n = strip(raw);
  let m = n.match(/^(.*)_([lr])$/i), base = n, side = null;
  if (m) { base = m[1]; side = m[2].toLowerCase() === 'l' ? 'Left' : 'Right'; }
  else { m = n.match(/^(.*[a-z])([lr])$/); if (m && m[1].length >= 3) { base = m[1]; side = m[2] === 'l' ? 'Left' : 'Right'; } }
  const name = base.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ').replace(/\bUscle\b/, 'Muscle');
  return { name, side, label: side ? `${name} (${side})` : name };
}

// ---- load meshes in world space ----
const meshes = [];
for (const p of META.parts) {
  const Q = new Int16Array(ab, p.pos, p.vCount * 3);
  for (const e of p.meshes) {
    const [raw, vS, vC] = e;
    const pos = new Float32Array(vC * 3);
    for (let i = 0; i < vC; i++) for (let a = 0; a < 3; a++) pos[i * 3 + a] = Q[(vS + i) * 3 + a] * K * p.half[a] + p.center[a];
    meshes.push({ raw, part: p.key, layer: p.layer, region: p.region, pos, ...structureLabel(raw) });
  }
}
const structs = new Map();
for (const m of meshes) {
  if (!structs.has(m.label)) structs.set(m.label, { label: m.label, name: m.name, side: m.side, layer: m.layer, region: m.region, meshes: [] });
  structs.get(m.label).meshes.push(m);
}
const cloud = (label) => {
  const s = structs.get(label);
  if (!s) throw new Error('missing structure ' + label);
  const pts = [];
  for (const m of s.meshes) for (let i = 0; i < m.pos.length; i += 3) pts.push([m.pos[i], m.pos[i + 1], m.pos[i + 2]]);
  return pts;
};
const mean = (pts) => [0, 1, 2].map((a) => pts.reduce((s, p) => s + p[a], 0) / pts.length);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const norm = (v) => Math.hypot(...v);
const unit = (v) => v.map((x) => x / norm(v));
const r3 = (v) => v.map((x) => Math.round(x * 1e4) / 1e4);

// ---- sphere fit (least squares): |p|^2 = 2 p.c + k, k = r^2 - |c|^2 ----
function fitSphere(pts) {
  // normal equations for [cx, cy, cz, k]
  const A = Array.from({ length: 4 }, () => Array(5).fill(0));
  for (const p of pts) {
    const row = [2 * p[0], 2 * p[1], 2 * p[2], 1];
    const rhs = p[0] * p[0] + p[1] * p[1] + p[2] * p[2];
    for (let i = 0; i < 4; i++) { for (let j = 0; j < 4; j++) A[i][j] += row[i] * row[j]; A[i][4] += row[i] * rhs; }
  }
  for (let i = 0; i < 4; i++) { // gauss
    let piv = i; for (let r = i + 1; r < 4; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    [A[i], A[piv]] = [A[piv], A[i]];
    for (let r = 0; r < 4; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c < 5; c++) A[r][c] -= f * A[i][c]; }
  }
  const c = [A[0][4] / A[0][0], A[1][4] / A[1][1], A[2][4] / A[2][2]];
  const k = A[3][4] / A[3][3];
  const rad = Math.sqrt(Math.max(0, k + c[0] * c[0] + c[1] * c[1] + c[2] * c[2]));
  const rms = Math.sqrt(pts.reduce((s, p) => s + (norm(sub(p, c)) - rad) ** 2, 0) / pts.length);
  return { centre: c, radius: rad, rms };
}

// ---- body axes from the mesh ----
const eyeC = mean([...cloud('Sclera L Grp1'), ...cloud('Sclera R Grp1')].length ? [...cloud('Sclera L Grp1'), ...cloud('Sclera R Grp1')] : [[0, 0, 0]]);
const skullC = mean(cloud('Occipital Bone'));
// right foot: the bones of the foot region (all of them) against the heel bone
const footPts = cloud('Calcaneus (Right)');
const toePts = meshes.filter((m) => m.region === 'ankle_foot' && m.layer === 'bone' && m.pos[0] < 0).flatMap((m) => { const a = []; for (let i = 0; i < m.pos.length; i += 3) a.push([m.pos[i], m.pos[i + 1], m.pos[i + 2]]); return a; });
const heel = mean(footPts), toe = [0, 0, Math.max(...toePts.map((p) => p[2]))];
const headTop = Math.max(...cloud('Frontal Bone').map((p) => p[1]));
const feetY = Math.min(...cloud('Calcaneus (Right)').map((p) => p[1]));
const humR = mean(cloud('Humerus (Right)')), humL = mean(cloud('Humerus (Left)'));
const axes = {
  forward: { evidence: 'the eyes are in front of the back of the skull, and the foot bones reach further than the heel', eyesZ: +eyeC[2].toFixed(3), occipitalZ: +skullC[2].toFixed(3), furthestFootBoneZ: +toe[2].toFixed(3), heelZ: +heel[2].toFixed(3), direction: eyeC[2] > skullC[2] && toe[2] > heel[2] ? '+z' : 'UNEXPECTED' },
  up: { evidence: 'head is above the feet', headTopY: +headTop.toFixed(3), heelY: +feetY.toFixed(3), direction: headTop > feetY ? '+y' : 'UNEXPECTED' },
  patientRight: { evidence: 'the right humerus is on the negative x side', rightHumerusX: +humR[0].toFixed(3), leftHumerusX: +humL[0].toFixed(3), direction: humR[0] < 0 && humL[0] > 0 ? '-x' : 'UNEXPECTED' },
  note: 'Right-handed system: +x is the patient\'s left, +y is up, +z is forward. Units are metres.',
};

// ---- pivots from the mesh ----
const hum = cloud('Humerus (Right)');
const humTop = Math.max(...hum.map((p) => p[1])), humBottom = Math.min(...hum.map((p) => p[1]));
// humeral head: vertices of the top 4.5 cm, then keep only those within 3.2 cm of their sphere fit (drops the neck)
let headPts = hum.filter((p) => p[1] > humTop - 0.045);
let head = fitSphere(headPts);
for (let it = 0; it < 4; it++) { headPts = hum.filter((p) => p[1] > humTop - 0.06 && Math.abs(norm(sub(p, head.centre)) - head.radius) < 0.004); head = fitSphere(headPts); }
const labrum = cloud('Glenoid Labrum (Right)');
const glenoid = mean(labrum);
// glenoid plane normal: smallest-variance direction of the labrum ring (power iteration on the covariance)
function planeNormal(pts) {
  const c = mean(pts); const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) { const d = sub(p, c); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j]; }
  // smallest eigenvector: inverse iteration with a small shift
  const M = C.map((r, i) => r.map((v, j) => v + (i === j ? 1e-9 : 0)));
  let v = [1, 1, 1];
  const solve = (A, b) => { const a = A.map((r, i) => [...r, b[i]]); for (let i = 0; i < 3; i++) { let p = i; for (let r = i + 1; r < 3; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r; [a[i], a[p]] = [a[p], a[i]]; for (let r = 0; r < 3; r++) if (r !== i) { const f = a[r][i] / a[i][i]; for (let c2 = i; c2 < 4; c2++) a[r][c2] -= f * a[i][c2]; } } return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]]; };
  for (let k = 0; k < 20; k++) v = unit(solve(M, v));
  return v;
}
let gNormal = planeNormal(labrum);
if (gNormal[0] > 0) gNormal = gNormal.map((x) => -x); // make it point laterally (towards -x for the right side)
// elbow: distal humerus (bottom 3.5 cm) and proximal ulna (top 3.5 cm)
const distalHum = hum.filter((p) => p[1] < humBottom + 0.035);
const ulna = cloud('Ulna (Right)'), ulnaTop = Math.max(...ulna.map((p) => p[1]));
const proxUlna = ulna.filter((p) => p[1] > ulnaTop - 0.035);
const elbowHum = mean(distalHum), elbowUlna = mean(proxUlna);
// flexion axis: widest horizontal direction of the distal humerus (epicondylar axis)
function widestHorizontal(pts) {
  const c = mean(pts); let best = [1, 0, 0], bestV = -1;
  for (let deg = 0; deg < 180; deg += 2) { const a = [Math.cos((deg * Math.PI) / 180), 0, Math.sin((deg * Math.PI) / 180)]; const v = pts.reduce((s, p) => s + ((p[0] - c[0]) * a[0] + (p[2] - c[2]) * a[2]) ** 2, 0); if (v > bestV) { bestV = v; best = a; } }
  return best;
}
const flexAxis = widestHorizontal(distalHum);
// wrist: distal ends of radius and ulna
const radius = cloud('Radius (Right)');
const wrist = mean([...radius.filter((p) => p[1] < Math.min(...radius.map((q) => q[1])) + 0.02), ...ulna.filter((p) => p[1] < Math.min(...ulna.map((q) => q[1])) + 0.02)]);
// sternoclavicular joint: medial end of the right clavicle (the vertices closest to the midline)
const clav = cloud('Clavicle (Right)');
const clavMedialX = Math.max(...clav.map((p) => p[0]));
const sc = mean(clav.filter((p) => p[0] > clavMedialX - 0.015));
const hangingAxis = unit(sub(elbowHum, head.centre));
const pivots = {
  humeralHead: r3(head.centre), humeralHeadRadius: +head.radius.toFixed(4), humeralHeadFitRms: +head.rms.toFixed(4), humeralHeadFitPoints: headPts.length,
  glenoid: r3(glenoid), glenoidNormal: r3(gNormal),
  headToGlenoid: +norm(sub(head.centre, glenoid)).toFixed(4),
  elbow: r3(elbowHum), elbowFromUlna: r3(elbowUlna), elbowHumerusToUlna: +norm(sub(elbowHum, elbowUlna)).toFixed(4), elbowFlexionAxisHorizontal: r3(flexAxis),
  wrist: r3(wrist),
  sternoclavicular: r3(sc),
  upperArmAxisHanging: r3(hangingAxis), upperArmLength: +norm(sub(elbowHum, head.centre)).toFixed(4), forearmLength: +norm(sub(wrist, elbowHum)).toFixed(4),
};

// ---- segment rules (explicit, by name; right side only) ----
const RULES = [
  // shoulder girdle: scapula, clavicle and everything that is part of or lies on them
  { seg: 'girdle', re: /^(scapula|clavicle|glenoid labrum)$/, why: 'bones of the shoulder girdle; the glenoid is part of the scapula' },
  { seg: 'girdle', re: /acromioclavicular|^coraco acromial ligament|transverse scapular ligament/, why: 'joint and ligaments between parts of the girdle (clavicle, acromion, scapula)' },
  { seg: 'girdle', re: /^(supraspinatus|infraspinatus|subscapular|teres minor|teres major) muscle/, why: 'rotator cuff and teres: the belly lies on the scapula (fossae, lateral border), only the short tendon reaches the humerus; the tendon end tears from the arm' },
  // upper arm
  { seg: 'upper', re: /^humerus$/, why: 'the bone of the upper arm' },
  { seg: 'upper', re: /deltoid/, why: 'the belly wraps the humeral head and shaft and inserts on the humerus; the origin on clavicle, acromion and spine tears slightly when the girdle turns' },
  { seg: 'upper', re: /biceps brachii|triceps brachii|^brachialis muscle|^coracobrachialis muscle/, why: 'the belly lies on the humerus; the proximal and distal tendons tear when the shoulder or elbow moves' },
  { seg: 'upper', re: /glenohumeral|^coracohumeral ligament|^transverse humeral ligament/, why: 'the capsule and ligaments hug the humeral head, so they turn with it' },
  // trunk muscles that cross to the shoulder: fixed, and the far end tears away
  { seg: 'trunk', re: /pectoralis (major|minor)|latissimus dorsi|trapezius|rhomboid|levator scapulae|serratus anterior|omohyoid|subclavius/, why: 'large trunk muscles: the belly lies on the trunk wall, so it stays fixed; the arm end tears away (gap near the insertion) instead of dragging the chest or back' },
  { seg: 'trunk', re: /sternoclavicular|costoclavicular|interclavicular/, why: 'the sternoclavicular joint is the pivot of the girdle, so it stays on the trunk' },
];
const FOREARM_ZONE = (c) => c.cx < -0.14 && c.cy > 0.55 && c.cy < 1.5 && c.xmax < -0.05; // right arm below the shoulder
const placed = []; // {label, seg, rule, why}
const unplaced = [];
const info = new Map();
for (const s of structs.values()) {
  let n = 0, sx = 0, sy = 0, sz = 0, xmax = -1e9;
  for (const m of s.meshes) for (let i = 0; i < m.pos.length; i += 3) { n++; sx += m.pos[i]; sy += m.pos[i + 1]; sz += m.pos[i + 2]; xmax = Math.max(xmax, m.pos[i]); }
  info.set(s.label, { cx: sx / n, cy: sy / n, cz: sz / n, xmax });
}
const sideOfName = (s) => (s.side ? s.side.toLowerCase() : /r Grp1$|ulnarisr Grp1/.test(s.label) ? 'right' : /l Grp1$/.test(s.label) ? 'left' : null);
for (const s of structs.values()) {
  const c = info.get(s.label);
  const side = sideOfName(s) ?? (c.cx < 0 ? 'right' : 'left');
  if (side !== 'right') continue;
  const lower = s.name.toLowerCase();
  const rule = RULES.find((r) => r.re.test(lower));
  if (rule) { placed.push({ label: s.label, seg: rule.seg, why: rule.why }); continue; }
  if (/femoris|metatarso|of leg|foot|toe|tibi|fibul|calcane|talus|metatars|sural|plantar/.test(lower)) continue; // leg and foot structures that sit in the arm zone by region mislabel
  if (FOREARM_ZONE(c)) {
    const hand = c.cy < wrist[1] - 0.005 || /metacarpal|phalanx|interossei|lumbrical|digiti minimi|pollicis|metacarpo|carpometacarpal|interphalangeal/.test(lower);
    placed.push({ label: s.label, seg: hand ? 'hand' : 'forearm', why: hand ? 'hand structure: below the wrist (no wrist motion is animated, so it moves with the forearm)' : 'elbow, forearm and wrist structures move with the forearm; at the elbow the humeral end tears slightly' });
    continue;
  }
  if (AREA_UNPLACED(lower)) unplaced.push({ label: s.label, why: 'shoulder-related name but no rule and not in the arm zone' });
}
function AREA_UNPLACED(l) { return /deltoid|scapul|clavic|humer|acromi|spinatus|teres (major|minor)|subscapular|rhomboid|trapezius|pectoralis|latissimus|brachii|brachialis|serratus anterior|levator scapulae/.test(l); }

const segs = { girdle: [], upper: [], forearm: [], hand: [] };
const table = [];
for (const p of placed) {
  if (p.seg === 'trunk') { table.push({ ...p, meshes: structs.get(p.label).meshes.length }); continue; }
  for (const m of structs.get(p.label).meshes) segs[p.seg].push(m.raw);
  table.push({ ...p, meshes: structs.get(p.label).meshes.length });
}
// sanity metric for the rules: distance of each structure centroid to the humeral head and to the scapula centroid
const scapC = mean(cloud('Scapula (Right)'));
const sanity = placed.filter((p) => ['deltoid', 'pector', 'latiss', 'trapez', 'supraspin', 'infraspin', 'subscap', 'teres', 'biceps brachii', 'triceps', 'rhomb', 'levator', 'serratus anterior', 'coracobr'].some((k) => p.label.toLowerCase().includes(k))).map((p) => {
  const c = info.get(p.label);
  const cc = [c.cx, c.cy, c.cz];
  return { label: p.label, seg: p.seg, toHumeralHeadCm: +(norm(sub(cc, head.centre)) * 100).toFixed(1), toScapulaCm: +(norm(sub(cc, scapC)) * 100).toFixed(1), toTrunkMidlineCm: +(Math.abs(c.cx) * 100).toFixed(1) };
});

// ---- (a) and (b): ranges, vertex sharing, and what the split would cost ----
let rangeGaps = 0, otherVertices = 0;
for (const p of META.parts) {
  const I = new Uint32Array(ab, p.idx, p.iCount); let nT = 0, nV = 0;
  for (const e of p.meshes) { const [, vS, vC, tS, tC] = e; if (tS !== nT || vS !== nV) rangeGaps++; nT = tS + tC; nV = vS + vC; for (let i = tS * 3; i < (tS + tC) * 3; i++) if (I[i] < vS || I[i] >= vS + vC) { otherVertices++; break; } }
}
const segOf = new Map(); for (const [seg, list] of Object.entries(segs)) for (const raw of list) segOf.set(raw, seg);
const cost = { pairs: {}, layerPairs: { bone: 0, muscle: 0 }, partsTouched: 0, trianglesMoved: 0, trianglesInTouchedParts: 0 };
for (const p of META.parts) {
  const bySeg = {};
  for (const e of p.meshes) { const seg = segOf.get(e[0]); if (seg) { bySeg[seg] = (bySeg[seg] || 0) + e[4]; cost.trianglesMoved += e[4]; } }
  const segsHere = Object.keys(bySeg);
  if (!segsHere.length) continue;
  cost.partsTouched++; cost.trianglesInTouchedParts += p.iCount / 3;
  for (const s of segsHere) { cost.pairs[`${p.key} / ${s}`] = bySeg[s]; cost.layerPairs[p.layer === 'bone' ? 'bone' : 'muscle']++; }
}
cost.extraDrawCallsBone = cost.layerPairs.bone;
cost.extraDrawCallsMuscle = cost.layerPairs.muscle;
cost.indexMemoryExtraMB = +((cost.trianglesInTouchedParts * 12) / 1048576).toFixed(2);

const out = {
  label: 'draft, awaiting clinician review',
  note: 'Computed by mobile/scripts/build-arm-rig.mjs from body-lite.json/.bin. The pack is not changed. Pivots and axes are computed from the mesh. Segment rules are explicit name rules with a reason each.',
  axes, pivots,
  signConventions: {
    elevation: 'angle of the upper arm from hanging (0), positive = up. Negative = backward (extension), see ANIMATION.md.',
    plane: 'direction of elevation: 0 = side (frontal plane), 90 = forward (sagittal plane), 30 = scapular plane. Elevation direction u = (-x)*cos(plane) + z*sin(plane); negative elevation moves the arm towards -z (backward).',
    rotation: 'humeral rotation about the long axis, positive = external (outward). With the arm hanging and the elbow bent 90 degrees, positive rotation swings the hand from forward (+z) to outward (-x).',
    elbow: 'elbow flexion, 0 = straight; positive bends the forearm forward (+z) when the arm hangs.',
    scapula: 'girdle rotation about the sternoclavicular joint, axis perpendicular to the scapular plane, positive = upward rotation (the glenoid rises).',
  },
  segments: segs,
  segmentCounts: Object.fromEntries(Object.entries(segs).map(([k, v]) => [k, v.length])),
  placed: table,
  unplaced,
  sanity,
  feasibility: {
    trianglesRangesContiguous: rangeGaps === 0,
    meshesSharingVerticesWithOthers: otherVertices,
    cost,
  },
};
fs.writeFileSync(path.join(root, 'src', 'data', 'arm_rig.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ axes, pivots, segmentCounts: out.segmentCounts, unplaced, feasibility: out.feasibility }, null, 1));
console.log('\nsanity (centroid distances, cm):');
for (const s of sanity) console.log(s.label.padEnd(50), s.seg.padEnd(7), 'head', s.toHumeralHeadCm, 'scapula', s.toScapulaCm, 'midline', s.toTrunkMidlineCm);
void repo;
