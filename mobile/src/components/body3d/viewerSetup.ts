// One place for what the picker (Body3D), the result view and the movement view (SegmentedBody) share: field of view,
// lights and the base material. The movement view must look like the picker, so nothing here is overridden per screen.
import * as THREE from 'three';

export const VIEWER_FOV = 45;
export const AMBIENT_INTENSITY = 1.2;
export const KEY_LIGHT = { intensity: 2, position: [3, 5, 4] as [number, number, number] };

/** The pack's base material. Opaque, vertex colours, depth written. Never made transparent for the whole model. */
export const BODY_MATERIAL_PARAMS = {
  vertexColors: true,
  roughness: 0.55,
  metalness: 0.05,
  transparent: false,
  opacity: 1,
  depthWrite: true,
} as const;

export function createBodyMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ ...BODY_MATERIAL_PARAMS });
}
