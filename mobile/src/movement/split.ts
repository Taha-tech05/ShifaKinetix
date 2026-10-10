// Splitting a merged pack part into segments by index subsets (no vertex copies, no pack rebuild).
// A part stores one vertex buffer and one index buffer; every source mesh owns a contiguous range of triangles and its
// own vertices. To move one structure we only need a new index list that holds its triangles, drawn with the same vertex
// buffer. This file does the bookkeeping on plain typed arrays so it can be tested without three.js or the pack.
import type { ArmRig } from './rig';

/** Which transform a triangle follows. The hand rides with the forearm (no wrist motion). */
export type Group = 'trunk' | 'girdle' | 'upper' | 'forearm';

export interface SplitInput {
  names: string[];
  triStart: ArrayLike<number>;
  triCount: ArrayLike<number>;
  indices: Uint32Array;
}

export interface SplitPiece {
  group: Group;
  /** Triangles of structures that are highlighted (they get their own mesh and material). */
  highlight: boolean;
  index: Uint32Array;
  triangles: number;
}

/** meshName -> group, from the rig. Anything not listed is trunk (fixed), including the whole left side. */
export function groupLookup(rig: Pick<ArmRig, 'segments'>): (meshName: string) => Group {
  const map = new Map<string, Group>();
  for (const n of rig.segments.girdle) map.set(n, 'girdle');
  for (const n of rig.segments.upper) map.set(n, 'upper');
  for (const n of rig.segments.forearm) map.set(n, 'forearm');
  for (const n of rig.segments.hand) map.set(n, 'forearm');
  return (name) => map.get(name) ?? 'trunk';
}

/**
 * Split the triangles of a part into pieces by (group, highlight). The pieces together hold every triangle exactly once.
 * `highlight` names are matched against mesh names.
 */
export function splitIndices(input: SplitInput, groupOf: (meshName: string) => Group, isHighlight: (meshName: string) => boolean = () => false): SplitPiece[] {
  const buckets = new Map<string, { group: Group; highlight: boolean; ranges: [number, number][] }>();
  for (let m = 0; m < input.names.length; m++) {
    const group = groupOf(input.names[m]);
    const highlight = isHighlight(input.names[m]);
    const key = `${group}|${highlight ? 1 : 0}`;
    if (!buckets.has(key)) buckets.set(key, { group, highlight, ranges: [] });
    buckets.get(key)!.ranges.push([input.triStart[m], input.triCount[m]]);
  }
  const pieces: SplitPiece[] = [];
  for (const b of buckets.values()) {
    let triangles = 0;
    for (const [, c] of b.ranges) triangles += c;
    if (triangles === 0) continue;
    const index = new Uint32Array(triangles * 3);
    let o = 0;
    for (const [s, c] of b.ranges) {
      index.set(input.indices.subarray(s * 3, (s + c) * 3), o);
      o += c * 3;
    }
    pieces.push({ group: b.group, highlight: b.highlight, index, triangles });
  }
  return pieces;
}
