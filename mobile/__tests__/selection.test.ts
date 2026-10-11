import { applyLayer, layerVisible, selectFromRay } from '../src/regions/select';
import { JOINTS, structureName, subRegionFromPoint } from '../src/regions/subregion';
import type { PackPart } from '../src/screens/model3d/pick';

const K = 32767;
// column-major scale + translation matrix, as THREE.Matrix4 holds for mesh.scale and mesh.position
const matrix = (s: number, t: number[]) => ({ elements: [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, t[0], t[1], t[2], 1] });

/** One triangle (front face towards +z) in a one-mesh part, centred at `at`, 0.1 m half size. */
function part(layer: string, meshName: string, at: number[]): PackPart {
  return {
    mesh: { visible: true, name: layer, matrixWorld: matrix(0.1, at) },
    layer: layer as PackPart['layer'],
    region: 'shoulder',
    names: [meshName],
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

// Fixture: along one ray into the right shoulder, from the front: a superficial muscle (z +0.10), a deep muscle
// (z +0.00) and a bone (z -0.05). The ray enters at the shoulder joint's height and side.
const J = JOINTS.right;
const rayOrigin = [J.x, J.y + 0.02, 1.0];
const rayDir = [0, 0, -1];
const SURFACE = 'Trapezius_muscler_Plane1';
const DEEP = 'Supraspinatus_muscler_Plane2';
const BONE = 'Scapular_boner_Plane3';
const fixture = () => [
  part('superficial', SURFACE, [J.x, J.y + 0.02, 0.1]),
  part('deep', DEEP, [J.x, J.y + 0.02, 0.0]),
  part('bone', BONE, [J.x, J.y + 0.02, -0.05]),
];

describe('layers', () => {
  it('muscle shows soft tissue, bone shows bone, skin is never shown', () => {
    expect(layerVisible('superficial', 'muscle')).toBe(true);
    expect(layerVisible('deep', 'muscle')).toBe(true);
    expect(layerVisible('bone', 'muscle')).toBe(false);
    expect(layerVisible('bone', 'bone')).toBe(true);
    expect(layerVisible('superficial', 'bone')).toBe(false);
    expect(layerVisible('skin', 'muscle')).toBe(false);
    expect(layerVisible('skin', 'bone')).toBe(false);
  });

  it('applyLayer hides the parts of the other layer', () => {
    const parts = fixture();
    applyLayer(parts, 'bone');
    expect(parts.map((p) => p.mesh.visible)).toEqual([false, false, true]);
    applyLayer(parts, 'muscle');
    expect(parts.map((p) => p.mesh.visible)).toEqual([true, true, false]);
  });
});

describe('selectFromRay', () => {
  it('muscle layer: a ray through a superficial muscle over a deep one returns the superficial muscle', () => {
    const r = selectFromRay(fixture(), 'muscle', rayOrigin, rayDir);
    expect(r).not.toBeNull();
    expect(r!.selection.hitStructure).toEqual({ meshName: SURFACE, name: 'Trapezius Muscle', kind: 'muscle' });
    expect(r!.selection.layer).toBe('muscle');
  });

  it('bone layer: the same ray returns the bone', () => {
    const r = selectFromRay(fixture(), 'bone', rayOrigin, rayDir);
    expect(r).not.toBeNull();
    expect(r!.selection.hitStructure).toMatchObject({ meshName: BONE, kind: 'bone' });
    expect(r!.selection.layer).toBe('bone');
  });

  it('the deep muscle is not returned in the muscle layer while a surface muscle covers it', () => {
    const r = selectFromRay(fixture(), 'muscle', rayOrigin, rayDir);
    expect(r!.selection.hitStructure!.meshName).not.toBe(DEEP);
  });

  it('always returns a layer, and side, sub-region and point from where the ray hit', () => {
    for (const layer of ['muscle', 'bone'] as const) {
      const r = selectFromRay(fixture(), layer, rayOrigin, rayDir);
      expect(r!.selection.layer).toBe(layer);
      expect(r!.selection.regionId).toBe('shoulder_right');
      expect(['front', 'back', 'top', 'side']).toContain(r!.selection.subRegionId);
      expect(r!.selection.point.x).toBeCloseTo(J.x, 3);
    }
  });

  it('names the sub-region from the hit point: a muscle hit in front of the joint is "front"', () => {
    expect(selectFromRay(fixture(), 'muscle', rayOrigin, rayDir)!.selection.subRegionId).toBe('front');
  });

  it('returns null when nothing is hit or the hit is not near a shoulder', () => {
    expect(selectFromRay(fixture(), 'muscle', [0.9, J.y, 1.0], rayDir)).toBeNull();
    expect(selectFromRay(fixture(), 'muscle', [J.x, J.y + 0.02, -1.0], [0, 0, 1])).toBeNull(); // back face is not hit
  });
});

describe('structureName', () => {
  it('drops the side and fixes the model typo', () => {
    expect(structureName('Scapular_part_of_deltoid_uscler_Generated_Mesh_From_X3D231_1')).toBe('Scapular Part Of Deltoid Muscle');
  });
});

describe('subRegionFromPoint', () => {
  const at = (dx: number, dy: number, dz: number) => ({ x: J.x + dx, y: J.y + dy, z: J.z + dz });
  it('labels top, front, back and side by where the point lies from the joint', () => {
    expect(subRegionFromPoint(at(0, 0.08, 0))?.subRegionId).toBe('top');
    expect(subRegionFromPoint(at(0, 0, 0.08))?.subRegionId).toBe('front');
    expect(subRegionFromPoint(at(0, 0, -0.08))?.subRegionId).toBe('back');
    expect(subRegionFromPoint(at(-0.08, 0, 0))?.subRegionId).toBe('side'); // outward for the right shoulder
  });
  it('uses the left shoulder for points on the left of the body', () => {
    const left = JOINTS.left;
    expect(subRegionFromPoint({ x: left.x, y: left.y + 0.08, z: left.z })).toMatchObject({ regionId: 'shoulder_left', subRegionId: 'top' });
  });
  it('is null far from the shoulder or well below it', () => {
    expect(subRegionFromPoint({ x: 0, y: 0.5, z: 0 })).toBeNull();
    expect(subRegionFromPoint(at(0, -0.15, 0))).toBeNull();
  });
});
