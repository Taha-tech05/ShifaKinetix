// Builds the segment meshes of the animated body from the pack, and fades a structure's material. No React or GL here, so
// it can be tested. The base material is the same one the picker uses (viewerSetup.createBodyMaterial): opaque, depth
// written. Only a tracked structure gets a material of its own, and only that one is ever tinted or ghosted.
import * as THREE from 'three';
import { rigFor } from '../../movement/rig';
import type { Side } from '../../movement/rig';
import { groupLookup, splitIndicesTagged } from '../../movement/split';
import type { Group } from '../../movement/split';
import { structureIdOfMesh } from '../../regions/regionMap';
import { layerVisible } from '../../regions/select';
import type { BodyLayer } from '../../regions/types';
import type { LoadedPack } from '../../screens/model3d/loadPack';
import { GHOST_OPACITY } from './highlightPlan';
import { createBodyMaterial } from './viewerSetup';

export const GROUPS: Group[] = ['trunk', 'girdle', 'upper', 'forearm'];
const MOVING: Group[] = ['girdle', 'upper', 'forearm'];
/** Colour of the moving arm (a multiplier on the pack's own colours, plus a little glow). Opacity stays 1. */
const ARM_TINT = new THREE.Color(0.78, 0.92, 1.0);
const ARM_GLOW = new THREE.Color(0.0, 0.07, 0.12);
export const GHOST_BODY_COLOR = '#2aa6a6';
export const GHOST_BODY_OPACITY = 0.16;
// A candidate is drawn cyan: the pack's own colour is almost multiplied away and a glow is added, so it stays visible on top
// of the orange muscles and the pale bones. Its opacity stays 1.
const TINT_COLOR = new THREE.Color(0.06, 0.42, 0.5);
const TINT_EMISSIVE = new THREE.Color(0.0, 0.38, 0.52);
const WHITE = new THREE.Color(1, 1, 1);
const BLACK = new THREE.Color(0, 0, 0);

/** Key of a tracked structure's material in Built.materials: the structure id, plus "|arm" on the tinted moving arm. */
export const materialKey = (id: string, arm: boolean) => (arm ? `${id}|arm` : id);
export const structureOfKey = (key: string) => key.replace(/\|arm$/, '');
export const isArmKey = (key: string) => key.endsWith('|arm');

export type Built = {
  root: THREE.Group;
  groups: Record<Group, THREE.Group>;
  materials: Map<string, THREE.MeshStandardMaterial>;
  /** Translucent copy of the moving segments, posed once at the end pose (empty when not asked for). */
  ghostRoot: THREE.Group;
  ghostGroups: Record<Group, THREE.Group>;
  /** The material of the end-pose ghost, so its opacity can follow how far the arm is from the end pose. */
  ghostMaterial: THREE.MeshStandardMaterial;
  dispose: () => void;
  triangles: number;
  meshes: number;
};

/**
 * Build segment meshes from the pack parts of the visible layer. Triangles of the `tracked` structures get their own
 * mesh and material (by structure id); everything else uses one base material made from the same parameters as the picker.
 */
export interface BuildOptions {
  side?: Side;
  /** Tint the moving arm segments with a distinct colour (the material is still opaque). */
  tintArm?: boolean;
  /** Add a faint translucent copy of the moving segments for the end pose. */
  endGhost?: boolean;
}

export function buildSegments(pack: Pick<LoadedPack, 'parts'>, layer: BodyLayer, tracked: ReadonlySet<string> = new Set(), options: BuildOptions = {}): Built {
  const { side = 'right', tintArm = false, endGhost = false } = options;
  const groupOf = groupLookup(rigFor(side));
  const tagOf = (name: string) => {
    if (tracked.size === 0) return null;
    const id = structureIdOfMesh(name);
    return id && tracked.has(id) ? id : null;
  };
  const root = new THREE.Group();
  const groups = {} as Record<Group, THREE.Group>;
  for (const g of GROUPS) {
    groups[g] = new THREE.Group();
    groups[g].matrixAutoUpdate = false;
    root.add(groups[g]);
  }
  const ghostRoot = new THREE.Group();
  const ghostGroups = {} as Record<Group, THREE.Group>;
  for (const g of GROUPS) {
    ghostGroups[g] = new THREE.Group();
    ghostGroups[g].matrixAutoUpdate = false;
    ghostRoot.add(ghostGroups[g]);
  }
  const base = createBodyMaterial();
  const armMaterial = createBodyMaterial();
  armMaterial.color.copy(ARM_TINT);
  armMaterial.emissive.copy(ARM_GLOW);
  const ghostMaterial = new THREE.MeshStandardMaterial({ color: GHOST_BODY_COLOR, transparent: true, opacity: GHOST_BODY_OPACITY, depthWrite: false, roughness: 0.8, metalness: 0 });
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const geometries: THREE.BufferGeometry[] = [];
  let triangles = 0;
  let meshes = 0;
  for (const part of pack.parts) {
    if (!layerVisible(part.layer, layer)) continue;
    const pieces = splitIndicesTagged({ names: part.names, triStart: part.triStart, triCount: part.triCount, indices: part.indices }, groupOf, tagOf);
    const src = part.mesh.geometry;
    const onlyTrunk = pieces.length === 1 && pieces[0].group === 'trunk' && pieces[0].tag === null;
    for (const piece of pieces) {
      const g = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'color']) g.setAttribute(name, src.getAttribute(name));
      // an untouched part reuses the pack's own index buffer; only split parts get new, smaller ones
      g.setIndex(onlyTrunk ? src.getIndex() : new THREE.BufferAttribute(piece.index, 1));
      g.boundingBox = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.sqrt(3));
      geometries.push(g);
      const armPiece = tintArm && piece.group !== 'trunk';
      let material = armPiece ? armMaterial : base;
      if (piece.tag !== null) {
        // a tracked structure has one material per look: as drawn on the trunk, and as drawn on the moving arm (tinted)
        const key = materialKey(piece.tag, armPiece);
        material = materials.get(key) ?? createBodyMaterial();
        materials.set(key, material);
      }
      const mesh = new THREE.Mesh(g, material);
      mesh.position.copy(part.mesh.position);
      mesh.scale.copy(part.mesh.scale);
      mesh.frustumCulled = false;
      groups[piece.group].add(mesh);
      if (endGhost && MOVING.includes(piece.group) && piece.group !== 'girdle') {
        const ghost = new THREE.Mesh(g, ghostMaterial);
        ghost.position.copy(part.mesh.position);
        ghost.scale.copy(part.mesh.scale);
        ghost.frustumCulled = false;
        ghostGroups[piece.group].add(ghost);
      }
      triangles += piece.triangles;
      meshes++;
    }
  }
  return {
    root,
    groups,
    materials,
    ghostRoot,
    ghostGroups,
    ghostMaterial,
    triangles,
    meshes,
    dispose: () => {
      // shared attributes belong to the pack; only the geometries and materials created here are released
      geometries.forEach((g) => g.dispose());
      base.dispose();
      armMaterial.dispose();
      ghostMaterial.dispose();
      materials.forEach((m) => m.dispose());
    },
  };
}

/** Set one structure's material to a tint amount and a ghost amount (both 0 to 1). At 0 and 0 it is the picker's look (or the arm tint on the moving arm). */
export function fadeMaterial(m: THREE.MeshStandardMaterial, tint: number, ghost: number, arm = false): void {
  m.color.copy(arm ? ARM_TINT : WHITE).lerp(TINT_COLOR, tint);
  m.emissive.copy(arm ? ARM_GLOW : BLACK).lerp(TINT_EMISSIVE, tint);
  const transparent = ghost > 0.001;
  if (m.transparent !== transparent) {
    m.transparent = transparent;
    m.needsUpdate = true;
  }
  m.opacity = 1 - (1 - GHOST_OPACITY) * ghost;
  m.depthWrite = ghost < 0.5;
}

/**
 * Opacity of the end-pose ghost for an arm that is `distanceDeg` degrees (summed over the joint angles) from the end pose.
 * Far from it the ghost shows at its full faint strength; as the arm arrives it fades out, so at the end pose it does not
 * wash the arm that is now in the same place. Only the ghost's own material changes, never the body's.
 */
export function ghostOpacityFor(distanceDeg: number): number {
  const x = Math.min(1, Math.max(0, (distanceDeg - 4) / 26));
  return GHOST_BODY_OPACITY * x * x * (3 - 2 * x);
}
