// PART 4 (offline renders): serves render.html + both models to a headless browser and saves the PNGs it posts back.
// Usage (from mobile/): node scripts/audit/render-server.mjs   (then it launches Edge itself)
// Output: docs/model-audit/screens/offline/*.png. READ-ONLY on the models.
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawn } from 'child_process';
import { GLB, LITE_BIN, LITE_JSON, OUT, bbox, loadOriginal, root, structureOf } from './lib.mjs';

const shotsDir = path.join(OUT, 'screens', 'offline');
fs.mkdirSync(shotsDir, { recursive: true });

// ---- shot list from the ORIGINAL geometry (so both models use identical cameras) ----
const orig = await loadOriginal();
const byStruct = new Map();
for (const m of orig) { const s = structureOf(m.name); if (!byStruct.has(s)) byStruct.set(s, []); byStruct.get(s).push(m); }
const MUSCLES = {
  supraspinatus: { structs: ['Supraspinatus Muscle (Right)'], view: 'back' },
  infraspinatus: { structs: ['Infraspinatus Muscle (Right)'], view: 'back' },
  'teres-minor': { structs: ['Teres Minor Muscle (Right)'], view: 'back' },
  subscapularis: { structs: ['Subscapular Muscle (Right)'], view: 'front' },
  deltoid: { structs: ['Acromial Part Of Deltoid Muscle (Right)', 'Clavicular Part Of Deltoid Muscle (Right)', 'Scapular Part Of Deltoid Uscle (Right)'], view: 'front' },
  trapezius: { structs: ['Descending Part Of Trapezius Muscle (Right)', 'Transverse Part Of Trapezius Muscle (Right)', 'Ascending Part Of Trapezius Muscle (Right)'], view: 'back' },
  'biceps-brachii': { structs: ['Long Head Of Biceps Brachii (Right)', 'Long Head Of Biceps Brachii Muscle (Right)', 'Short Head Of Biceps Brachii (Right)', 'Medial Head Of Biceps Brachii Muscle (Right)'], view: 'front' },
  'pectoralis-major': { structs: ['Clavicular Head Of Pectoralis Major Muscle (Right)', 'Sternocostal Head Of Pectoralis Major Muscle (Right)', 'Abdominal Part Of Pectoralis Major Muscle (Right)'], view: 'front' },
};
const CONTEXT_BONES = ['Clavicle (Right)', 'Scapula (Right)', 'Humerus (Right)'];
const names = (structs) => structs.flatMap((s) => (byStruct.get(s) || []).map((m) => m.name));
const missingStructs = Object.values(MUSCLES).flatMap((m) => m.structs).filter((s) => !byStruct.has(s));
if (missingStructs.length) throw new Error('unknown structures: ' + missingStructs.join(', '));

const shots = [];
for (const [key, def] of Object.entries(MUSCLES)) {
  const tn = names(def.structs);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const n of tn) { const m = orig.find((x) => x.name === n); const b = bbox(m.pos); for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], b.lo[a]); hi[a] = Math.max(hi[a], b.hi[a]); } }
  const center = lo.map((l, a) => (l + hi[a]) / 2), longest = Math.max(...hi.map((h, a) => h - lo[a]));
  const dir = def.view === 'back' ? [-0.25, 0.2, -1] : [-0.25, 0.2, 1];
  const ctx = names(CONTEXT_BONES);
  for (const model of ['lite', 'orig']) {
    shots.push({ file: `${key}-${model}-overview.png`, model, show: [...tn, ...ctx], dir, target: center, size: 0.55, fov: 35 });
    shots.push({ file: `${key}-${model}-close.png`, model, show: [...tn, ...ctx], dir, target: center, size: longest * 1.25, fov: 35 });
  }
}
// Layers of the lite pack around the right shoulder, front and back (layer = pack part layer).
const rs = names(CONTEXT_BONES);
const rsBox = (() => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const n of rs) { const b = bbox(orig.find((x) => x.name === n).pos); for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], b.lo[a]); hi[a] = Math.max(hi[a], b.hi[a]); } } return { c: lo.map((l, a) => (l + hi[a]) / 2) }; })();
for (const layer of ['skin', 'superficial', 'deep', 'bone']) for (const view of ['front', 'back'])
  shots.push({ file: `layer-${layer}-${view}-lite.png`, model: 'lite', layer, dir: view === 'back' ? [-0.25, 0.2, -1] : [-0.25, 0.2, 1], target: rsBox.c, size: 0.6, fov: 35, onlyRegionBox: true });

// ---- server ----
const send = (res, code, body, type = 'text/plain') => { res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' }); res.end(body); };
const serveFile = (res, file, type) => {
  if (!fs.existsSync(file)) return send(res, 404, 'nf');
  const st = fs.statSync(file);
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size });
  fs.createReadStream(file).pipe(res);
};
let saved = 0;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/save') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const name = path.basename(u.searchParams.get('name'));
      const b64 = Buffer.concat(chunks).toString().replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(path.join(shotsDir, name), Buffer.from(b64, 'base64'));
      saved++; console.error('saved', name, `${saved}/${shots.length}`); send(res, 200, 'ok');
    });
    return;
  }
  if (req.method === 'POST' && u.pathname === '/done') { send(res, 200, 'ok'); console.error('page reported done'); setTimeout(() => { edge.kill(); server.close(); process.exit(0); }, 500); return; }
  if (req.method === 'POST' && u.pathname === '/log') { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => { console.error('[page]', Buffer.concat(c).toString()); send(res, 200, 'ok'); }); return; }
  if (u.pathname === '/shots.json') return send(res, 200, JSON.stringify(shots), 'application/json');
  if (u.pathname === '/render.html') return serveFile(res, path.join(root, 'scripts', 'audit', 'render.html'), 'text/html');
  if (u.pathname === '/orig.glb') return serveFile(res, GLB, 'model/gltf-binary');
  if (u.pathname === '/lite.json') return serveFile(res, LITE_JSON, 'application/json');
  if (u.pathname === '/lite.bin') return serveFile(res, LITE_BIN, 'application/octet-stream');
  if (u.pathname.startsWith('/three/')) return serveFile(res, path.join(root, 'node_modules', 'three', u.pathname.slice(7)), 'text/javascript');
  send(res, 404, 'nf');
});
server.listen(8765, '127.0.0.1');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const edge = spawn(EDGE, ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1000,1000', '--user-data-dir=' + path.join(process.env.TEMP, 'audit-edge-profile'), 'http://127.0.0.1:8765/render.html'], { stdio: 'ignore' });
setTimeout(() => { console.error('timeout, exiting'); edge.kill(); process.exit(2); }, 20 * 60 * 1000);
