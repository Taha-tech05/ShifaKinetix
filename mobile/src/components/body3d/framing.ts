// Keeps the whole body in the part of the screen that the chat sheet leaves free, WITHOUT resizing the canvas (resizing the GL surface
// on every sheet move is slow and makes the model pop). The three.js camera can draw the same picture into a smaller window of the
// canvas (setViewOffset): the body is scaled down and centred above the sheet, and it glides there when the sheet moves.
import type * as THREE from 'three';

export interface FramingState {
  /** 1 = the whole canvas, smaller = the picture is drawn into that fraction of the canvas height (top aligned, centred sideways) */
  s: number;
}

export const newFraming = (): FramingState => ({ s: 1 });

/** The fraction of the canvas height that stays free above a sheet covering `inset` px at the bottom. */
export const freeFraction = (height: number, inset: number): number => (inset > 0 && height > 0 ? Math.min(1, Math.max(0.35, (height - inset) / height)) : 1);

/** Call every frame. Eases toward the target fraction and updates the camera only while it changes. */
export function applyFraming(camera: THREE.PerspectiveCamera, size: { width: number; height: number }, inset: number, st: FramingState, dt: number): void {
  const target = freeFraction(size.height, inset);
  let next = st.s;
  if (Math.abs(target - next) < 0.002) next = target;
  else next = next + (target - next) * Math.min(1, dt * 9);
  const changed = next !== st.s || (next < 0.999) !== !!camera.view?.enabled;
  if (!changed) return;
  st.s = next;
  if (next >= 0.999) {
    if (camera.view) camera.clearViewOffset();
  } else {
    const fw = size.width * next;
    const fh = size.height * next;
    camera.setViewOffset(fw, fh, -(size.width - fw) / 2, 0, size.width, size.height);
  }
  camera.updateProjectionMatrix();
}
