// Pure picking logic for the merged pack. No imports, so it runs under jest/node without three.

export type Layer = 'skin' | 'superficial' | 'deep' | 'bone';

/** The slice of THREE.Mesh the picker needs (a real THREE.Mesh satisfies it). */
export type PickMesh = { visible: boolean; matrixWorld: { elements: ArrayLike<number> }; name: string };

export type PackPart<M extends PickMesh = PickMesh> = {
  mesh: M;
  layer: Layer;
  region: string;
  names: string[];
  vStart: Int32Array;
  vCount: Int32Array;
  triStart: Int32Array; // sorted: faceIndex -> mesh lookup by binary search
  triCount: Int32Array;
  bounds: Float32Array; // 6 floats per mesh: min xyz, max xyz (normalized part space)
  positions: Int16Array;
  indices: Uint32Array;
  originalColors: Uint8Array; // pristine copy so highlight can be restored
};

export type PackHit<M extends PickMesh = PickMesh> = { part: PackPart<M>; index: number; name: string; distance: number; face: number };

/** Which source mesh owns this triangle of a merged part? Binary search over sorted triStart. */
export function meshIndexForFace(part: Pick<PackPart, 'triStart'>, faceIndex: number): number {
  let lo = 0;
  let hi = part.triStart.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (part.triStart[mid] <= faceIndex) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Inverse of an affine column-major 4x4 (rotation/scale/translation): 3x3 row-major inverse plus translation. */
function invertAffine(e: ArrayLike<number>): { r: number[]; t: number[] } {
  const a = e[0], b = e[4], c = e[8], d = e[1], f = e[5], g = e[9], h = e[2], i = e[6], j = e[10];
  const A = f * j - g * i, B = g * h - d * j, C = d * i - f * h;
  const k = 1 / (a * A + b * B + c * C);
  const r = [
    A * k, (c * i - b * j) * k, (b * g - c * f) * k,
    B * k, (a * j - c * h) * k, (c * d - a * g) * k,
    C * k, (b * h - a * i) * k, (a * f - b * d) * k,
  ];
  const tx = e[12], ty = e[13], tz = e[14];
  return { r, t: [-(r[0] * tx + r[1] * ty + r[2] * tz), -(r[3] * tx + r[4] * ty + r[5] * tz), -(r[6] * tx + r[7] * ty + r[8] * tz)] };
}

/**
 * Picks muscles along a world-space ray (origin + t * unit direction, t = world distance).
 * For each visible part it moves the ray into the part's quantized space, skips every source mesh whose AABB the ray
 * misses, and runs front-face Moller-Trumbore only over the triangle range of the meshes that survive.
 * Returns every hit, nearest first, with the owning mesh resolved from the triangle range.
 */
export function pickPack<M extends PickMesh>(parts: PackPart<M>[], origin: ArrayLike<number>, direction: ArrayLike<number>): PackHit<M>[] {
  const hits: PackHit<M>[] = [];
  for (const part of parts) {
    if (!part.mesh.visible) continue;
    const { r, t } = invertAffine(part.mesh.matrixWorld.elements);
    const ox = r[0] * origin[0] + r[1] * origin[1] + r[2] * origin[2] + t[0];
    const oy = r[3] * origin[0] + r[4] * origin[1] + r[5] * origin[2] + t[1];
    const oz = r[6] * origin[0] + r[7] * origin[1] + r[8] * origin[2] + t[2];
    // linear part only: keeps t equal to the world distance even though the local space is scaled
    const dx = r[0] * direction[0] + r[1] * direction[1] + r[2] * direction[2];
    const dy = r[3] * direction[0] + r[4] * direction[1] + r[5] * direction[2];
    const dz = r[6] * direction[0] + r[7] * direction[1] + r[8] * direction[2];
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    const P = part.positions, I = part.indices, B = part.bounds;
    const K = 1 / 32767;
    for (let m = 0; m < part.names.length; m++) {
      const b = m * 6;
      let t0 = (B[b] - ox) * ix, t1 = (B[b + 3] - ox) * ix;
      let tmin = Math.min(t0, t1), tmax = Math.max(t0, t1);
      t0 = (B[b + 1] - oy) * iy; t1 = (B[b + 4] - oy) * iy;
      tmin = Math.max(tmin, Math.min(t0, t1)); tmax = Math.min(tmax, Math.max(t0, t1));
      t0 = (B[b + 2] - oz) * iz; t1 = (B[b + 5] - oz) * iz;
      tmin = Math.max(tmin, Math.min(t0, t1)); tmax = Math.min(tmax, Math.max(t0, t1));
      if (!(tmax >= Math.max(tmin, 0))) continue;
      const f0 = part.triStart[m], f1 = f0 + part.triCount[m];
      for (let f = f0; f < f1; f++) {
        const a = I[f * 3] * 3, bb = I[f * 3 + 1] * 3, c = I[f * 3 + 2] * 3;
        const ax = P[a] * K, ay = P[a + 1] * K, az = P[a + 2] * K;
        const e1x = P[bb] * K - ax, e1y = P[bb + 1] * K - ay, e1z = P[bb + 2] * K - az;
        const e2x = P[c] * K - ax, e2y = P[c + 1] * K - ay, e2z = P[c + 2] * K - az;
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (det < 1e-12) continue; // back face (or parallel): front faces only
        const inv = 1 / det;
        const tx = ox - ax, ty = oy - ay, tz = oz - az;
        const u = (tx * px + ty * py + tz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const dist = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (dist > 0) hits.push({ part, index: m, name: part.names[m], distance: dist, face: f });
      }
    }
  }
  return hits.sort((x, y) => x.distance - y.distance);
}
