import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as THREE from 'three';
import type { PackPart as GenericPart } from './pick';

export type PackPart = GenericPart<THREE.Mesh>;

const CHUNK = 4 * 1024 * 1024;

// File.arrayBuffer() allocates the whole file in the Android Java heap and can OOM on large files.
// Read through a FileHandle in small chunks into one JS ArrayBuffer instead.
export async function readFileChunked(file: File): Promise<ArrayBuffer> {
  const size = file.size;
  const out = new Uint8Array(size);
  const handle = file.open();
  try {
    let pos = 0;
    while (pos < size) {
      const chunk = handle.readBytes(Math.min(CHUNK, size - pos));
      out.set(chunk, pos);
      pos += chunk.length;
      if (chunk.length === 0) break;
    }
  } finally {
    handle.close();
  }
  return out.buffer;
}


export { meshIndexForFace, pickPack } from './pick';
export type { PackHit } from './pick';

// Format written by scripts/build-model-pack.mjs: one merged, quantized mesh per (layer, region).
import type { Layer } from './pick';
export type { Layer } from './pick';

type PartMeta = {
  key: string;
  layer: Layer;
  region: string;
  vCount: number;
  iCount: number;
  center: number[];
  half: number[];
  // name, vStart, vCount, triStart, triCount, then AABB min xyz / max xyz in the part's normalized space
  meshes: [string, number, number, number, number, number, number, number, number, number, number][];
  pos: number;
  nrm: number;
  col: number;
  idx: number;
};

export type PackMeta = {
  parts: PartMeta[];
  bbox: { min: number[]; max: number[] };
  stats: { triangles: number; vertices: number; drawCalls: number; meshCount: number; bytes: number };
};


export type LoadedPack = {
  root: THREE.Group;
  parts: PackPart[];
  meta: PackMeta;
  triangles: number;
  meshCount: number;
  bytes: number;
  timings: { assetMs: number; readMs: number; parseMs: number; totalMs: number };
};

const HIGHLIGHT_LINEAR = [0, 0.8, 1]; // cyan
const MIX = 0.75;

export async function loadPack(binModule: number, meta: PackMeta): Promise<LoadedPack> {
  const t0 = Date.now();
  const asset = Asset.fromModule(binModule);
  console.log('[BodyViewer] pack asset.downloadAsync start', asset.uri);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Pack asset has no localUri');
  const t1 = Date.now();
  console.log('[BodyViewer] pack asset ready (copy)', t1 - t0, 'ms');

  const buffer = await readFileChunked(new File(asset.localUri));
  const t2 = Date.now();
  console.log('[BodyViewer] pack read', buffer.byteLength, 'bytes in', t2 - t1, 'ms');

  // Parse = wrap typed-array views over the one buffer (no copies) and build geometries.
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  const root = new THREE.Group();
  const parts: PackPart[] = [];
  for (const m of meta.parts) {
    const g = new THREE.BufferGeometry();
    const positions = new Int16Array(buffer, m.pos, m.vCount * 3);
    const indices = new Uint32Array(buffer, m.idx, m.iCount);
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3, true));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(buffer, m.nrm, m.vCount * 3), 3, true));
    const colors = new Uint8Array(buffer, m.col, m.vCount * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    // Positions are quantized to [-1, 1] per axis, so the bounds are known without scanning vertices
    // (computeBoundingSphere over 1M+ vertices costs seconds in Hermes).
    g.boundingBox = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), Math.sqrt(3));
    const mesh = new THREE.Mesh(g, material);
    mesh.scale.set(m.half[0], m.half[1], m.half[2]);
    mesh.position.set(m.center[0], m.center[1], m.center[2]);
    mesh.name = m.key;
    root.add(mesh);
    parts.push({
      mesh,
      layer: m.layer,
      region: m.region,
      names: m.meshes.map((e) => e[0]),
      vStart: Int32Array.from(m.meshes, (e) => e[1]),
      vCount: Int32Array.from(m.meshes, (e) => e[2]),
      triStart: Int32Array.from(m.meshes, (e) => e[3]),
      triCount: Int32Array.from(m.meshes, (e) => e[4]),
      bounds: Float32Array.from(m.meshes.flatMap((e) => e.slice(5) as number[])),
      positions,
      indices,
      originalColors: colors.slice(),
    });
  }
  const t3 = Date.now();
  return {
    root,
    parts,
    meta,
    triangles: meta.stats.triangles,
    meshCount: meta.stats.meshCount,
    bytes: buffer.byteLength,
    timings: { assetMs: t1 - t0, readMs: t2 - t1, parseMs: t3 - t2, totalMs: t3 - t0 },
  };
}


/** Recolors only that mesh's vertex range (cyan blend). */
export function highlightMesh(part: PackPart, i: number) {
  const attr = part.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
  const arr = attr.array as Uint8Array;
  const start = part.vStart[i] * 3;
  const end = start + part.vCount[i] * 3;
  for (let k = start; k < end; k += 3) {
    for (let a = 0; a < 3; a++) {
      const base = part.originalColors[k + a] / 255;
      arr[k + a] = Math.round((base * (1 - MIX) + HIGHLIGHT_LINEAR[a] * MIX) * 255);
    }
  }
  // full re-upload of this part's color buffer: partial update ranges are not reliable on expo-gl
  attr.clearUpdateRanges();
  attr.needsUpdate = true;
}

export function restoreMesh(part: PackPart, i: number) {
  const attr = part.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
  const arr = attr.array as Uint8Array;
  const start = part.vStart[i] * 3;
  const end = start + part.vCount[i] * 3;
  arr.set(part.originalColors.subarray(start, end), start);
  // full re-upload of this part's color buffer: partial update ranges are not reliable on expo-gl
  attr.clearUpdateRanges();
  attr.needsUpdate = true;
}

export function disposePack(pack: LoadedPack | null) {
  if (!pack) return;
  pack.parts.forEach((p) => p.mesh.geometry.dispose());
  (pack.parts[0]?.mesh.material as THREE.Material | undefined)?.dispose();
}

