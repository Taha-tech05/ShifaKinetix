// Keeps the whole body in the part of the screen that the chat sheet leaves free, WITHOUT resizing the canvas (resizing the GL surface
// on every sheet move is slow and makes the model pop). The three.js camera can draw the same picture into a smaller window of the
// canvas (setViewOffset): the body is scaled down and centred above the sheet, and it glides there when the sheet moves.
import type * as THREE from 'three';

export interface FramingState {
  /** The part of the canvas height that is free above the sheet (1 = the sheet covers nothing). Eases toward the target. */
  s: number;
}

export const newFraming = (): FramingState => ({ s: 1 });

/** The fraction of the canvas height that stays free above a sheet covering `inset` px at the bottom. */
export const freeFraction = (height: number, inset: number): number => (inset > 0 && height > 0 ? Math.min(1, Math.max(0.35, (height - inset) / height)) : 1);

/**
 * The body is never drawn smaller than this fraction of its full size: it is CENTRED in the free area instead, so it stays big. With a tall
 * sheet a little of the head and feet can then be hidden behind the top controls and the sheet; compress the sheet to see all of it.
 */
export const MIN_BODY_SCALE = 0.55;

/** Call every frame. Eases toward the target and updates the camera only while it changes. */
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
    // draw at scale k (not smaller than MIN_BODY_SCALE) and put the middle of the picture in the middle of the free area
    const k = Math.max(next, MIN_BODY_SCALE);
    const fw = size.width * k;
    const fh = size.height * k;
    const y = ((k - next) * size.height) / 2;
    camera.setViewOffset(fw, fh, -(size.width - fw) / 2, y, size.width, size.height);
  }
  camera.updateProjectionMatrix();
}
