// Which structures lie in the pack's deep soft-tissue layer. The pack calls its layers superficial and deep (a geometry
// guess); here that is only used to decide which muscles to ghost over a deep candidate.
import { structureIdOfMesh } from '../../regions/regionMap';
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
