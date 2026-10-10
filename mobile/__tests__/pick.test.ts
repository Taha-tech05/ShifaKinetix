import * as fs from 'fs';
import * as path from 'path';
import { PackPart, meshIndexForFace, pickPack } from '../src/screens/model3d/pick';

const K = 32767;
// column-major scale + translation matrix (what THREE.Matrix4 holds for mesh.scale / mesh.position)
const matrix = (s: number[], t: number[]) => ({ elements: [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, t[0], t[1], t[2], 1] });

function trianglePart(scale: number, pos: number[]): PackPart {
  return {
    mesh: { visible: true, name: 'p', matrixWorld: matrix([scale, scale, scale], pos) },
    layer: 'deep',
    region: 'test',
    names: ['tri'],
    vStart: Int32Array.of(0),
    vCount: Int32Array.of(3),
    triStart: Int32Array.of(0),
    triCount: Int32Array.of(1),
    bounds: Float32Array.of(-1, -1, 0, 1, 1, 0),
    positions: Int16Array.from([-K, -K, 0, K, -K, 0, 0, K, 0]),
    indices: Uint32Array.of(0, 1, 2),
    originalColors: new Uint8Array(9),
  };
}

describe('pickPack', () => {
  test('front-facing hit returns world distance and mesh name', () => {
    const hits = pickPack([trianglePart(2, [0, 0, -5])], [0, -0.5, 0], [0, 0, -1]);
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe('tri');
    expect(hits[0].distance).toBeCloseTo(5, 4);
  });
  test('misses outside the triangle and ignores back faces', () => {
    const part = trianglePart(2, [0, 0, -5]);
    expect(pickPack([part], [5, 0, 0], [0, 0, -1])).toHaveLength(0);
    expect(pickPack([part], [0, -0.5, -10], [0, 0, 1])).toHaveLength(0);
  });
  test('hidden parts are skipped', () => {
    const part = trianglePart(1, [0, 0, -5]);
    part.mesh.visible = false;
    expect(pickPack([part], [0, -0.2, 0], [0, 0, -1])).toHaveLength(0);
  });
  test('meshIndexForFace binary search', () => {
    expect([0, 9, 10, 24, 25, 99].map((f) => meshIndexForFace({ triStart: Int32Array.of(0, 10, 25) }, f))).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

// Real data from scripts/build-model-pack.mjs: a ray aimed at a triangle (from outside, along its normal) must resolve to
// that triangle and its owning mesh. Checks winding, quantization, offsets and the triangle-range lookup. Skipped if absent.
const metaPath = path.join(__dirname, '..', 'assets', 'models', 'pack', 'body-lite.json');
const binPath = path.join(__dirname, '..', 'assets', 'models', 'pack', 'body-lite.bin');
(fs.existsSync(metaPath) && fs.existsSync(binPath) ? describe : describe.skip)('pickPack on the real lite pack', () => {
  test('rays at triangle centroids resolve to the owning triangle and mesh name', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const buf = fs.readFileSync(binPath);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    let checked = 0;
    let ok = 0;
    const why = { other: 0 };
    for (const m of meta.parts) {
      const positions = new Int16Array(ab, m.pos, m.vCount * 3);
      const indices = new Uint32Array(ab, m.idx, m.iCount);
      const part: PackPart = {
        mesh: { visible: true, name: m.key, matrixWorld: matrix(m.half, m.center) },
        layer: m.layer,
        region: m.region,
        names: m.meshes.map((e: any[]) => e[0]),
        vStart: Int32Array.from(m.meshes, (e: any[]) => e[1]),
        vCount: Int32Array.from(m.meshes, (e: any[]) => e[2]),
        triStart: Int32Array.from(m.meshes, (e: any[]) => e[3]),
        triCount: Int32Array.from(m.meshes, (e: any[]) => e[4]),
        bounds: Float32Array.from(m.meshes.flatMap((e: any[]) => e.slice(5))),
        positions,
        indices,
        originalColors: new Uint8Array(0),
      };
      for (let mi = 0; mi < part.names.length; mi += Math.max(1, Math.floor(part.names.length / 4))) {
        const f = part.triStart[mi] + Math.floor(part.triCount[mi] / 2);
        const w = (k: number) => [0, 1, 2].map((a) => (positions[indices[f * 3 + k] * 3 + a] / K) * m.half[a] + m.center[a]);
        const [A, B, C] = [w(0), w(1), w(2)];
        const e1 = B.map((v, a) => v - A[a]);
        const e2 = C.map((v, a) => v - A[a]);
        let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const len = Math.hypot(n[0], n[1], n[2]);
        if (len < 1e-14) continue; // degenerate triangle
        n = n.map((v) => v / len);
        const cen = A.map((v, a) => (v + B[a] + C[a]) / 3);
        const OFFSET = 0.002;
        const origin = cen.map((v, a) => v + n[a] * OFFSET);
        const hits = pickPack([part], origin, n.map((v) => -v));
        checked++;
        // the target triangle must be in the hit list at the right distance, owned by the right mesh
        // (nearer hits are legitimate when other surfaces of the same part sit within millimetres)
        if (hits.some((h) => h.face === f && Math.abs(h.distance - OFFSET) < 1e-5 && h.name === part.names[mi])) ok++;
        else why.other++;
      }
    }
    console.log(`real-pack picks: ${ok}/${checked}`, why);
    expect(checked).toBeGreaterThan(100);
    expect(ok).toBe(checked);
  });
});
