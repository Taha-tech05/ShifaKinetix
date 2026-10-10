// Summarises docs/model-audit/per-muscle.csv into markdown tables (docs/model-audit/part2-tables.md).
import fs from 'fs';
import path from 'path';
import { OUT } from './lib.mjs';

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  const head = rows.shift();
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const rows = parseCsv(fs.readFileSync(path.join(OUT, 'per-muscle.csv'), 'utf8')).map((r) => ({
  ...r, orig_tris: +r.orig_tris, lite_tris: +r.lite_tris, kept: +r.tris_kept_pct, maxErr: +r.max_err_pct, meanErr: +r.mean_err_pct, bbox: +r.bbox_change_pct_of_longest, vol: r.volume_change_pct === '' ? null : +r.volume_change_pct, area: +r.area_change_pct,
}));
const md = (list, cols) => ['| ' + cols.map((c) => c[0]).join(' | ') + ' |', '|' + cols.map(() => '---').join('|') + '|', ...list.map((r) => '| ' + cols.map((c) => c[1](r)).join(' | ') + ' |')].join('\n');
const COLS = [
  ['Structure', (r) => r.structure], ['Type', (r) => r.category],
  ['Tris orig', (r) => r.orig_tris], ['Tris lite', (r) => r.lite_tris], ['Kept %', (r) => r.kept.toFixed(1)],
  ['BBox change % of longest', (r) => r.bbox.toFixed(2)], ['Mean err %', (r) => r.meanErr.toFixed(3)], ['Max err %', (r) => r.maxErr.toFixed(3)],
  ['Max err mm', (r) => (+r.max_err_mm).toFixed(1)], ['Area change %', (r) => r.area.toFixed(1)], ['Volume change %', (r) => (r.vol === null ? '-' : r.vol.toFixed(1))], ['Status', (r) => r.status + (r.flags ? ' (' + r.flags + ')' : '')],
];
const count = (f) => rows.filter(f).length;
const out = [];
out.push(`## Part 2 totals\n\nStructures compared: ${rows.length}. PASS ${count((r) => r.status === 'PASS')}, WARN ${count((r) => r.status === 'WARN')}, FAIL ${count((r) => r.status === 'FAIL')}.\n`);
out.push('Reasons (a structure can have several):\n');
const reasons = new Map();
for (const r of rows) for (const f of r.flags.split('; ').filter(Boolean)) { const k = f.replace(/ \(.*\)/, ''); reasons.set(k, (reasons.get(k) || 0) + 1); }
out.push([...reasons].map(([k, v]) => `- ${k}: ${v}`).join('\n') + '\n');
const noLoss = rows.filter((r) => r.status === 'FAIL' && r.flags.includes('no loss')).length;
const failReal = rows.filter((r) => r.status === 'FAIL' && !(r.flags.includes('lite<50') && r.flags.includes('no loss') && !r.flags.includes('bbox')));
out.push(`FAIL for "lite < 50 triangles" where the original was also under 50 triangles (nothing was lost by the pack): ${noLoss}.\nFAIL rows that are NOT explained by that: ${failReal.length}.\n`);
out.push('### FAIL rows not explained by tiny originals\n\n' + (failReal.length ? md(failReal, COLS) : 'None.') + '\n');
out.push('### 10 lowest percentage of triangles kept (structures with at least 100 original triangles)\n\n' + md([...rows].filter((r) => r.orig_tris >= 100).sort((a, b) => a.kept - b.kept).slice(0, 10), COLS) + '\n');
out.push('### 10 highest max shape error\n\n' + md([...rows].sort((a, b) => b.maxErr - a.maxErr).slice(0, 10), COLS) + '\n');
out.push('### 10 highest mean shape error\n\n' + md([...rows].sort((a, b) => b.meanErr - a.meanErr).slice(0, 10), COLS) + '\n');
const SH = /deltoid|supraspin|infraspin|teres m(ajor|inor)|subscapular|trapezius|levator scapulae|rhomboid|biceps brachii|triceps brachii|pectoralis|latissimus|^clavicle|^scapula|^humerus|serratus anterior|coracobrachialis/i;
const shoulder = rows.filter((r) => SH.test(r.structure)).sort((a, b) => a.structure.localeCompare(b.structure));
out.push(`### Shoulder structures (${shoulder.length})\n\n` + md(shoulder, COLS) + '\n');
const wm = rows.filter((r) => r.status === 'WARN' && r.category !== 'bone');
out.push(`### Status by type\n\n` + ['bone', 'superficial', 'deep'].map((c) => `- ${c}: ${rows.filter((r) => r.category === c).length} structures, WARN ${rows.filter((r) => r.category === c && r.status === 'WARN').length}, FAIL ${rows.filter((r) => r.category === c && r.status === 'FAIL').length}`).join('\n') + `\n(structures with mixed layers appear under their own combined label)\n`);
void wm;
const text = out.join('\n');
fs.writeFileSync(path.join(OUT, 'part2-tables.md'), text);
console.log(text.slice(0, 200000));
