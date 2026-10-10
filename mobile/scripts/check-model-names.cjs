// Report-only: compares mesh names in a GLB with names in
// _web_reference/segments.csv and _web_reference/regionMap.json.
// Usage: node scripts/check-model-names.cjs [path/to/model.glb]
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const glbPath = process.argv[2] || path.join(root, 'assets', 'models', 'model.glb');

function readGlbJson(file) {
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(20);
  fs.readSync(fd, head, 0, 20, 0);
  const jsonLen = head.readUInt32LE(12);
  const buf = Buffer.alloc(jsonLen);
  fs.readSync(fd, buf, 0, jsonLen, 20);
  fs.closeSync(fd);
  return JSON.parse(buf.toString('utf8'));
}

// Same rule three.js GLTFLoader applies to node names (PropertyBinding.sanitizeNodeName).
const sanitize = (n) => n.replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '');

async function loadedMeshNames(file) {
  // Parse with the real three.js GLTFLoader so we see exactly the mesh.name values the app will see.
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const b = fs.readFileSync(file);
  const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  const gltf = await new GLTFLoader().parseAsync(ab, '');
  const names = new Set();
  gltf.scene.traverse((o) => { if (o.isMesh) names.add(o.name); });
  return names;
}

main().catch((e) => { console.error(e); process.exit(1); });
async function main() {
const glbNames = await loadedMeshNames(glbPath);
const glbSanitized = new Set([...glbNames].map(sanitize));
const regionMap = JSON.parse(fs.readFileSync(path.join(root, '_web_reference', 'regionMap.json'), 'utf8'));
const csvLines = fs.readFileSync(path.join(root, '_web_reference', 'segments.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
const csvNames = new Set(csvLines.slice(1).map((l) => l.split(',')[0]));
const mapNames = new Set(Object.keys(regionMap));

const inGlb = (n) => glbNames.has(n) || glbSanitized.has(n) || glbSanitized.has(sanitize(n));
const list = (title, arr) => {
  console.log(`\n${title}: ${arr.length}`);
  arr.slice(0, 40).forEach((n) => console.log('  ' + n));
  if (arr.length > 40) console.log(`  ... and ${arr.length - 40} more`);
};

console.log(`GLB: ${path.basename(glbPath)}  meshes as loaded by GLTFLoader: ${glbNames.size}`);
console.log(`segments.csv names: ${csvNames.size}   regionMap.json names: ${mapNames.size}`);
list('segments.csv names missing from GLB', [...csvNames].filter((n) => !inGlb(n)));
list('regionMap.json names missing from GLB', [...mapNames].filter((n) => !inGlb(n)));
list('GLB meshes missing from segments.csv', [...glbNames].filter((n) => !csvNames.has(n) && !csvNames.has(sanitize(n))));
list('GLB meshes missing from regionMap.json', [...glbNames].filter((n) => !mapNames.has(n) && !mapNames.has(sanitize(n))));
list('In segments.csv but not regionMap.json', [...csvNames].filter((n) => !mapNames.has(n)));
list('In regionMap.json but not segments.csv', [...mapNames].filter((n) => !csvNames.has(n)));
}
