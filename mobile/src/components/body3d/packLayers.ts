// Which structures lie in the pack's deep soft-tissue layer. The pack calls its layers superficial and deep (a geometry
// guess); here that is only used to decide which muscles to ghost over a deep candidate.
import { structureIdOfMesh } from '../../regions/regionMap';
import type { Vec3 } from '../../movement/rig';
import type { LoadedPack } from '../../screens/model3d/loadPack';

export function deepStructureIds(pack: Pick<LoadedPack, 'parts'>): Set<string> {
  const deep = new Set<string>();
  for (const part of pack.parts) {
    if (part.layer !== 'deep') continue;
    for (const n of part.names) {
      const id = structureIdOfMesh(n);
      if (id) deep.add(id);
    }
  }
  return deep;
}

/**
 * Where each structure is in the model (the middle of its meshes' bounding boxes, in model space), for labels. Computed
 * from the pack's per-mesh bounds, so it is cheap. Structures that are not in the pack are left out.
 */
export function structureAnchors(pack: Pick<LoadedPack, 'parts'>, ids: string[]): Record<string, Vec3> {
  const want = new Set(ids);
  const sum = new Map<string, { p: Vec3; n: number }>();
  for (const part of pack.parts) {
    part.names.forEach((name, i) => {
      const id = structureIdOfMesh(name);
      if (!id || !want.has(id)) return;
      const b = part.bounds;
      const c = [0, 1, 2].map((a) => (b[i * 6 + a] + b[i * 6 + 3 + a]) / 2);
      const w: Vec3 = [part.mesh.position.x + part.mesh.scale.x * c[0], part.mesh.position.y + part.mesh.scale.y * c[1], part.mesh.position.z + part.mesh.scale.z * c[2]];
      const e = sum.get(id) ?? { p: [0, 0, 0] as Vec3, n: 0 };
      e.p = [e.p[0] + w[0], e.p[1] + w[1], e.p[2] + w[2]];
      e.n++;
      sum.set(id, e);
    });
  }
  const out: Record<string, Vec3> = {};
  sum.forEach((e, id) => (out[id] = [e.p[0] / e.n, e.p[1] / e.n, e.p[2] / e.n]));
  return out;
}
