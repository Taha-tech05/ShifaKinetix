// PART 1: inventory. Compares mesh names and structures between model.glb and body-lite.
// Usage (from mobile/): node scripts/audit/part1-inventory.mjs
import fs from 'fs';
import path from 'path';
import { OUT, loadLite, loadOriginal, structureOf, writeCsv } from './lib.mjs';

const orig = await loadOriginal();
const lite = loadLite();

const origNames = orig.map((m) => m.name);
const liteNames = lite.meshes.map((m) => m.name);
const oSet = new Set(origNames), lSet = new Set(liteNames);
const dup = (arr) => [...new Set(arr.filter((n, i) => arr.indexOf(n) !== i))];

const missing = origNames.filter((n) => !lSet.has(n));
const extra = liteNames.filter((n) => !oSet.has(n));

// Structures (anatomical name + side): sub-meshes such as _1/_2 belong to one structure.
const oStruct = new Map(), lStruct = new Map();
for (const m of orig) { if (!oStruct.has(structureOf(m.name))) oStruct.set(structureOf(m.name), []); oStruct.get(structureOf(m.name)).push(m.name); }
for (const m of lite.meshes) { if (!lStruct.has(structureOf(m.name))) lStruct.set(structureOf(m.name), []); lStruct.get(structureOf(m.name)).push(m.name); }
const missingStruct = [...oStruct.keys()].filter((s) => !lStruct.has(s));
const extraStruct = [...lStruct.keys()].filter((s) => !oStruct.has(s));
const partialStruct = [...oStruct.keys()].filter((s) => lStruct.has(s) && lStruct.get(s).length !== oStruct.get(s).length);

// "Merged": the pack merges meshes of one layer+region into one draw call but keeps a triangle range per mesh,
// so no mesh loses its identity. Report parts and how many meshes each holds.
const partRows = lite.parts.map((p) => ({ part: p.key, layer: p.layer, region: p.region, meshes: p.meshNames.length }));

// Triangle ranges must cover every triangle of a part exactly once (so the picker can map every triangle to a mesh).
let rangeProblems = 0;
for (const p of lite.parts) {
  let next = 0;
  for (let i = 0; i < p.triStart.length; i++) { if (p.triStart[i] !== next) rangeProblems++; next = p.triStart[i] + p.triCount[i]; }
  if (next * 3 !== p.I.length) rangeProblems++;
}

// Shoulder check by real names.
const WANT = [
  ['supraspinatus', /^Supraspinatus/i],
  ['infraspinatus', /^Infraspinatus/i],
  ['teres minor', /^Teres_minor/i],
  ['teres major', /^Teres_major/i],
  ['subscapularis', /^Subscapular/i],
  ['deltoid anterior (clavicular part)', /^Clavicular_part_of_deltoid/i],
  ['deltoid middle (acromial part)', /^Acromial_part_of_deltoid/i],
  ['deltoid posterior (scapular spine part)', /^Scapular_part_of_deltoid/i],
  ['trapezius, descending part', /^Descending_part_of_trapezius/i],
  ['trapezius, transverse part', /^Transverse_part_of_trapezius/i],
  ['trapezius, ascending part', /^Ascending_part_of_trapezius/i],
  ['levator scapulae', /^Levator_scapula/i],
  ['rhomboid major', /^Rhomboid_major/i],
  ['rhomboid minor', /^Rhomboid_minor/i],
  ['biceps brachii, long head', /^Long_head_of_biceps_brachii/i],
  ['biceps brachii, short head', /^Short_head_of_biceps_brachii/i],
  ['biceps brachii, medial head (as named in model)', /^Medial_head_of_biceps_brachii/i],
  ['triceps brachii (any head)', /triceps_brachii/i],
  ['pectoralis major, clavicular head', /^Clavicular_head_of_pectoralis_major/i],
  ['pectoralis major, sternocostal head', /^Sternocostal_head_of_pectoralis_major/i],
  ['pectoralis major, abdominal part', /^Abdominal_part_of_pectoralis_major/i],
  ['pectoralis minor', /^Pectoralis_minor/i],
  ['latissimus dorsi', /^Latissimus_dorsi/i],
  ['clavicle (bone)', /^Clavicle/i],
  ['scapula (bone)', /^Scapula[lr]?_/i],
  ['humerus (bone)', /^Humerus/i],
  ['acromion (separate mesh)', /^Acromion/i],
];
const shoulderChecks = WANT.map(([label, re]) => {
  const o = origNames.filter((n) => re.test(n));
  const l = liteNames.filter((n) => re.test(n));
  return { item: label, orig_meshes: o.length, lite_meshes: l.length, status: o.length === 0 ? 'NOT IN ORIGINAL' : l.length === o.length ? 'FOUND (all kept)' : l.length === 0 ? 'FAIL (missing in lite)' : 'FAIL (some missing)', names: o.join(' | ') };
});
// Other shoulder-related names not asked for.
const RELATED = /deltoid|scapul|clavic|humer|acromi|supraspin|infraspin|teres_m|subscap|rhomboid|trapezius|pectoral|latissim|biceps_brach|triceps|coracobrach|serratus_ant|omohyoid|glenoid|glenohum|coracoid|levator_scap|brachialis/i;
const asked = new Set(shoulderChecks.flatMap((c) => c.names.split(' | ')));
const related = [...new Set(origNames.filter((n) => RELATED.test(n) && !asked.has(n)).map(structureOf))];

fs.mkdirSync(OUT, { recursive: true });
const rows = orig.map((m) => ({ name: m.name, structure: structureOf(m.name), material: m.mat, orig_tris: m.idx.length / 3, in_lite: lSet.has(m.name) ? 'yes' : 'NO' }));
writeCsv(path.join(OUT, 'part1-names.csv'), rows, ['name', 'structure', 'material', 'orig_tris', 'in_lite']);
writeCsv(path.join(OUT, 'part1-shoulder-checks.csv'), shoulderChecks, ['item', 'orig_meshes', 'lite_meshes', 'status', 'names']);

const summary = {
  origMeshes: orig.length, liteMeshes: lite.meshes.length,
  origStructures: oStruct.size, liteStructures: lStruct.size,
  missingMeshes: missing, extraMeshes: extra, missingStructures: missingStruct, extraStructures: extraStruct, partialStructures: partialStruct,
  duplicateNamesOrig: dup(origNames), duplicateNamesLite: dup(liteNames),
  parts: partRows.length, rangeProblems,
  shoulderChecks: shoulderChecks.map(({ names, ...r }) => r), relatedNotAsked: related,
};
fs.writeFileSync(path.join(OUT, 'part1-summary.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ...summary, relatedNotAsked: related.length, parts: partRows.length }, null, 1));
console.log('\nRELATED (not asked):\n' + related.join('\n'));
