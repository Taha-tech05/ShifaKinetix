// Builds shared/regions_shoulder.json (region -> sub-region -> structure) from the structure names in the lite pack
// manifest, using NAME RULES only (no geometry, no guesses). Also writes docs/region-map-report.md, which lists every
// shoulder-area structure that no rule mapped. Nothing is dropped silently.
//
// Usage (from mobile/): node scripts/build-region-map.mjs
// Reads:  assets/models/pack/body-lite.json   (read-only)
// Writes: ../shared/regions_shoulder.json, ../docs/region-map-report.md
//
// Every item is "draft, awaiting clinician review". Urdu and Roman Urdu labels need a native speaker's review.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(root, 'assets', 'models', 'pack', 'body-lite.json');
const OUT_JSON = path.join(root, '..', 'shared', 'regions_shoulder.json');
const OUT_REPORT = path.join(root, '..', 'docs', 'region-map-report.md');
const REVIEW = 'draft, awaiting clinician review';

// ---- structure names (mirror of src/screens/model3d/meshNameUtils.ts, pure string logic) ----
function strip(name) {
  let n = name;
  n = n.replace(/_?Generated_Mesh_From_X3D\d+/gi, '');
  n = n.replace(/_(Cube|Cone|Plane|Cylinder|BezierCurve|Sphere|Circle)\d+/gi, '');
  n = n.replace(/_[12]$/, '');
  n = n.replace(/_?0*\d{2,3}$/, '');
  return n;
}
function splitSide(name) {
  let m = name.match(/^(.*)_([lr])$/i);
  if (m) return { base: m[1], side: m[2].toLowerCase() === 'l' ? 'left' : 'right' };
  m = name.match(/^(.*[a-z])([lr])$/);
  if (m && m[1].length >= 3) return { base: m[1], side: m[2] === 'l' ? 'left' : 'right' };
  return { base: name, side: null };
}
const title = (s) => s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
const fixTypo = (s) => s.replace(/\bUscle\b/, 'Muscle'); // typo in the source model

// ---- sub-regions ----
// Labels are the same words the app shows (src/i18n subRegions). Urdu and Roman Urdu need a native speaker's review.
const SUB_REGIONS = [
  { id: 'top', labels: { en: 'top', ur: 'اوپر', roman: 'upar' } },
  { id: 'front', labels: { en: 'front', ur: 'سامنے', roman: 'samne' } },
  { id: 'side', labels: { en: 'side', ur: 'پہلو', roman: 'pehlu' } },
  { id: 'back', labels: { en: 'back', ur: 'پیچھے', roman: 'peeche' } },
  { id: 'scapular', labels: { en: 'shoulder blade', ur: 'کندھے کی ہڈی', roman: 'kandhe ki haddi' } },
];

// ---- rules: structure name (lower case, side removed) -> sub-regions. Anatomical location by name (textbook). ----
const ALL = ['top', 'front', 'side', 'back', 'scapular'];
const RULES = [
  { id: 'deltoid-clavicular', re: /^clavicular part of deltoid/, sub: ['front'] },
  { id: 'deltoid-acromial', re: /^acromial part of deltoid/, sub: ['side', 'top'] },
  { id: 'deltoid-scapular', re: /^scapular part of deltoid/, sub: ['back'] },
  { id: 'supraspinatus', re: /^supraspinatus muscle/, sub: ['top', 'scapular'] },
  { id: 'infraspinatus', re: /^infraspinatus muscle/, sub: ['back', 'scapular'] },
  { id: 'teres-minor', re: /^teres minor muscle/, sub: ['back', 'scapular'] },
  { id: 'teres-major', re: /^teres major muscle/, sub: ['back', 'scapular'] },
  { id: 'subscapularis', re: /^subscapular muscle/, sub: ['front', 'scapular'] },
  { id: 'trapezius-descending', re: /^descending part of trapezius/, sub: ['top', 'scapular'] },
  { id: 'trapezius-transverse', re: /^transverse part of trapezius/, sub: ['back', 'scapular'] },
  { id: 'trapezius-ascending', re: /^ascending part of trapezius/, sub: ['scapular'] },
  { id: 'levator-scapulae', re: /^levator scapulae/, sub: ['top', 'scapular'] },
  { id: 'rhomboid', re: /^rhomboid (major|minor) muscle/, sub: ['scapular'] },
  { id: 'pectoralis-major', re: /pectoralis major muscle/, sub: ['front'] },
  { id: 'pectoralis-minor', re: /^pectoralis minor muscle/, sub: ['front'] },
  { id: 'coracobrachialis', re: /^coracobrachialis muscle/, sub: ['front'] },
  { id: 'biceps-brachii', re: /biceps brachii/, sub: ['front'] },
  { id: 'triceps-brachii', re: /triceps brachii/, sub: ['back', 'side'] },
  { id: 'latissimus-dorsi', re: /^latissimus dorsi muscle/, sub: ['back', 'side'] },
  { id: 'serratus-anterior', re: /^serratus anterior muscle/, sub: ['side', 'scapular'] },
  { id: 'omohyoid', re: /^omohyoid muscle/, sub: ['top'] },
  { id: 'clavicle', re: /^clavicle$/, sub: ['top', 'front'] },
  { id: 'scapula', re: /^scapula$/, sub: ['scapular', 'back', 'top'] },
  { id: 'humerus', re: /^humerus$/, sub: ALL.filter((s) => s !== 'scapular') },
  { id: 'acromioclavicular', re: /acromioclavicular/, sub: ['top'] },
  { id: 'coraco-acromial', re: /^coraco acromial ligament/, sub: ['top', 'front'] },
  { id: 'coracohumeral', re: /^coracohumeral ligament/, sub: ['front'] },
  { id: 'glenohumeral', re: /glenohumeral/, sub: ['front', 'side', 'back', 'top'] },
  { id: 'glenoid-labrum', re: /^glenoid labrum/, sub: ['front', 'side', 'back', 'top'] },
  { id: 'transverse-humeral', re: /^transverse humeral ligament/, sub: ['front'] },
  { id: 'transverse-scapular', re: /transverse scapular ligament/, sub: ['top', 'scapular'] },
  { id: 'sternoclavicular', re: /sternoclavicular|costoclavicular|interclavicular/, sub: ['front'] },
];
// Names that make a structure "shoulder-area" even if no rule maps it, so the report cannot miss it.
const AREA = /deltoid|scapula|scapular|clavic|humerus|humeral ligament|glenohumeral|glenoid|acromi|supraspinatus|infraspinatus|teres (major|minor)|subscapular|rhomboid|trapezius|pectoralis|latissimus|biceps brachii|triceps brachii|coracobrachialis|coraco|serratus anterior|levator scapulae|omohyoid|brachialis|sternoclavicular|costoclavicular|interclavicular|rotator/i;

// ---- read manifest and group meshes into structures ----
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const structures = new Map(); // id -> {label, name, side, layers:Set, meshNames:[]}
for (const part of manifest.parts) {
  for (const e of part.meshes) {
    const raw = e[0];
    const { base, side } = splitSide(strip(raw));
    const name = fixTypo(title(base));
    const label = side ? `${name} (${side === 'left' ? 'Left' : 'Right'})` : name;
    if (!structures.has(label)) structures.set(label, { label, name, side, layers: new Set(), meshNames: [], packRegions: new Set() });
    const s = structures.get(label);
    s.layers.add(part.layer);
    s.packRegions.add(part.region);
    s.meshNames.push(raw);
  }
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const items = {};
const unmapped = [];
const regions = { right: {}, left: {} };
for (const r of Object.values(regions)) for (const sr of SUB_REGIONS) r[sr.id] = [];

for (const s of [...structures.values()].sort((a, b) => a.label.localeCompare(b.label))) {
  const lower = s.name.toLowerCase();
  const hits = RULES.filter((r) => r.re.test(lower));
  const inArea = hits.length > 0 || AREA.test(lower);
  if (!inArea) continue;
  const id = slug(s.label);
  const kind = s.layers.has('bone') && s.layers.size === 1 ? 'bone' : 'muscle'; // "muscle" = all soft tissue, as in the app
  if (hits.length === 0) {
    unmapped.push({ id, label: s.label, kind, packRegions: [...s.packRegions].sort(), meshCount: s.meshNames.length, reason: 'shoulder-area name, no rule' });
    continue;
  }
  const sub = [...new Set(hits.flatMap((h) => h.sub))];
  const sides = s.side ? [s.side] : ['right', 'left']; // a structure without a side suffix would belong to both sides
  items[id] = {
    label: s.label,
    name: s.name,
    side: s.side,
    kind,
    subRegions: sub,
    rules: hits.map((h) => h.id),
    meshNames: s.meshNames,
    source: `name rule ${hits.map((h) => h.id).join(', ')}: anatomical location from the structure name (textbook), not from geometry`,
    review: REVIEW,
  };
  for (const side of sides) for (const sr of sub) regions[side][sr].push(id);
}

const out = {
  label: REVIEW,
  note: 'Built by mobile/scripts/build-region-map.mjs from the structure names in body-lite.json with name rules only. A structure can belong to several sub-regions. Unmapped shoulder-area structures are listed in "unmapped" and in docs/region-map-report.md. Urdu and Roman Urdu labels need a native speaker\'s review.',
  source: 'name rules in mobile/scripts/build-region-map.mjs; Z-Anatomy "Myology" structure names (see docs/3d-model.md)',
  generatedFrom: 'mobile/assets/models/pack/body-lite.json',
  subRegions: SUB_REGIONS.map((s) => ({ ...s, review: REVIEW, urduNeedsNativeReview: true })),
  regions: ['right', 'left'].map((side) => ({
    id: `shoulder_${side}`,
    side,
    labels: { en: `${side === 'right' ? 'Right' : 'Left'} shoulder`, ur: side === 'right' ? 'دایاں کندھا' : 'بایاں کندھا', roman: side === 'right' ? 'Dayan kandha' : 'Bayan kandha' },
    subRegions: regions[side],
    review: REVIEW,
    urduNeedsNativeReview: true,
  })),
  structures: items,
  unmapped,
};
fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 1) + '\n');

// ---- report ----
const count = Object.keys(items).length;
const lines = [];
lines.push('# Shoulder region map report', '', `Status: ${REVIEW}. Generated by \`mobile/scripts/build-region-map.mjs\`. Do not edit by hand.`, '');
lines.push(`- Shoulder-area structures with a rule: **${count}** (sides counted separately).`);
lines.push(`- Shoulder-area structures with no rule (**unmapped**): **${unmapped.length}**.`, '');
lines.push('## Structures per side and sub-region', '', '| Sub-region | Right | Left |', '|---|---|---|');
for (const sr of SUB_REGIONS) lines.push(`| ${sr.labels.en} | ${regions.right[sr.id].length} | ${regions.left[sr.id].length} |`);
lines.push('', '## Unmapped shoulder-area structures', '', 'These match a shoulder-area name but no sub-region rule, so they are not in any sub-region. They are listed here instead of being dropped. Most are outside the shoulder (upper arm, spine) and belong to other regions in the full project.', '');
if (unmapped.length) {
  lines.push('| Structure | Type | Pack region | Meshes |', '|---|---|---|---|');
  for (const u of unmapped) lines.push(`| ${u.label} | ${u.kind} | ${u.packRegions.join(', ')} | ${u.meshCount} |`);
} else lines.push('None.');
lines.push('', '## Rules', '', '| Rule | Sub-regions | Structures matched |', '|---|---|---|');
for (const r of RULES) lines.push(`| ${r.id} | ${r.sub.join(', ')} | ${Object.values(items).filter((i) => i.rules.includes(r.id)).length} |`);
lines.push('');
fs.writeFileSync(OUT_REPORT, lines.join('\n'));
console.log(`mapped ${count} structures, unmapped ${unmapped.length}`);
for (const u of unmapped) console.log('  unmapped:', u.label, u.packRegions.join(','));
