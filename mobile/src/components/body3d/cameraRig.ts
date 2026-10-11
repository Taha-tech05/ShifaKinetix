// Camera state for the movement viewer: pure maths, no three.js, so it can be tested.
//
// Rules (movement UX brief):
//  - The animation never touches the camera. Only this module and the touch handler do.
//  - A preset is applied once as the initial view (with an eased transition). The first touch cancels the transition and
//    from then on the camera is never moved by anything except the user, until "Reset view".
//  - One finger orbits, two fingers pinch (zoom) and drag (pan). Zoom, pitch and pan are limited so the model cannot be lost.
// The camera orbits a target point. Yaw 0 looks from +z (the front of the body) towards -z; positive yaw moves the camera
// towards +x (the patient's left).
import type { Vec3 } from '../../movement/rig';

/** Camera preset in a movement's data: where the camera is, what it looks at, the field of view and the zoom. */
export interface CameraPreset {
  position: Vec3;
  target: Vec3;
  fov: number;
  zoom: number;
}

export interface CameraView {
  yaw: number;
  pitch: number;
  distance: number;
  target: Vec3;
  zoom: number;
  fov: number;
}

export interface CameraRig {
  /** What the camera shows now. */
  view: CameraView;
  /** Where "Reset view" and the automatic framing go. */
  home: CameraView;
  /** True while the camera is still easing to `home`. The first touch sets it to false. */
  framing: boolean;
  /** True once the user has moved the camera. The preset is then never applied again except by Reset view. */
  touched: boolean;
}

export const PITCH_MIN = -1.0;
export const PITCH_MAX = 1.2;
/** Zoom stays between these multiples of the preset zoom. */
export const ZOOM_MIN_FACTOR = 0.6;
export const ZOOM_MAX_FACTOR = 3;
/** The look-at point may move this far (metres) from the preset target. */
export const PAN_LIMIT = 0.35;
/** Radians of orbit per pixel of one-finger drag. */
export const ORBIT_SPEED = 0.008;
/** Seconds for the eased transition to the preset (time constant of the exponential ease). */
export const FRAME_TAU = 0.18;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mirrorX = (v: Vec3): Vec3 => [-v[0], v[1], v[2]];

/** The preset for the left side is the right-side preset mirrored in x. */
export function presetForSide(p: CameraPreset, side: 'right' | 'left'): CameraPreset {
  return side === 'right' ? p : { ...p, position: mirrorX(p.position), target: mirrorX(p.target) };
}

export function viewFromPreset(p: CameraPreset): CameraView {
  const dx = p.position[0] - p.target[0];
  const dy = p.position[1] - p.target[1];
  const dz = p.position[2] - p.target[2];
  const distance = Math.hypot(dx, dy, dz);
  return { yaw: Math.atan2(dx, dz), pitch: Math.asin(clamp(dy / distance, -1, 1)), distance, target: [...p.target], zoom: p.zoom, fov: p.fov };
}

/** Camera position of a view. */
export function positionOf(v: CameraView): Vec3 {
  const c = Math.cos(v.pitch);
  return [v.target[0] + v.distance * Math.sin(v.yaw) * c, v.target[1] + v.distance * Math.sin(v.pitch), v.target[2] + v.distance * Math.cos(v.yaw) * c];
}

export function createCameraRig(p: CameraPreset, animateFrom?: CameraView): CameraRig {
  const home = viewFromPreset(p);
  return { view: animateFrom ? { ...animateFrom, target: [...animateFrom.target] } : { ...home, target: [...home.target] }, home, framing: animateFrom !== undefined, touched: false };
}

const copyView = (v: CameraView): CameraView => ({ ...v, target: [...v.target] });

/** The user touched the camera: stop easing to the preset and keep what the user sets. */
export function userTouched(rig: CameraRig): void {
  rig.touched = true;
  rig.framing = false;
}

/** One-finger drag. */
export function orbit(rig: CameraRig, dxPx: number, dyPx: number): void {
  userTouched(rig);
  rig.view.yaw -= dxPx * ORBIT_SPEED;
  rig.view.pitch = clamp(rig.view.pitch + dyPx * ORBIT_SPEED, PITCH_MIN, PITCH_MAX);
}

/** Pinch: `scale` is the new finger distance over the old one (above 1 = fingers apart = zoom in). */
export function pinch(rig: CameraRig, scale: number): void {
  userTouched(rig);
  const base = rig.home.zoom;
  rig.view.zoom = clamp(rig.view.zoom * scale, base * ZOOM_MIN_FACTOR, base * ZOOM_MAX_FACTOR);
}

/** Two-finger drag in pixels; `viewportHeightPx` turns pixels into metres at the target distance. */
export function pan(rig: CameraRig, dxPx: number, dyPx: number, viewportHeightPx: number): void {
  userTouched(rig);
  const v = rig.view;
  const metresPerPx = (2 * v.distance * Math.tan((v.fov * Math.PI) / 360)) / (v.zoom * Math.max(1, viewportHeightPx));
  const right: Vec3 = [Math.cos(v.yaw), 0, -Math.sin(v.yaw)];
  const up: Vec3 = [-Math.sin(v.pitch) * Math.sin(v.yaw), Math.cos(v.pitch), -Math.sin(v.pitch) * Math.cos(v.yaw)];
  const next: Vec3 = [0, 1, 2].map((a) => v.target[a] - right[a] * dxPx * metresPerPx + up[a] * dyPx * metresPerPx) as Vec3;
  const off: Vec3 = [next[0] - rig.home.target[0], next[1] - rig.home.target[1], next[2] - rig.home.target[2]];
  const len = Math.hypot(...off);
  const k = len > PAN_LIMIT ? PAN_LIMIT / len : 1;
  v.target = [rig.home.target[0] + off[0] * k, rig.home.target[1] + off[1] * k, rig.home.target[2] + off[2] * k];
}

/**
 * A new preset (the next movement). Before the user touches the camera it eases there. After a touch it only changes what
 * "Reset view" will go to; the camera itself is not moved.
 */
export function setPreset(rig: CameraRig, p: CameraPreset): void {
  rig.home = viewFromPreset(p);
  if (!rig.touched) rig.framing = true;
}

/** "Reset view": go back to the preset (eased) and hand the camera back to the automatic framing. */
export function resetView(rig: CameraRig, instant = false): void {
  rig.touched = false;
  if (instant) {
    rig.view = copyView(rig.home);
    rig.framing = false;
  } else {
    rig.framing = true;
  }
}

const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/** Ease the view towards the preset while `framing` is true; a no-op once the user has touched the camera. */
export function stepFraming(rig: CameraRig, dt: number): void {
  if (!rig.framing || rig.touched) return;
  const k = 1 - Math.exp(-Math.max(0, dt) / FRAME_TAU);
  const v = rig.view;
  const h = rig.home;
  v.yaw += angleDelta(v.yaw, h.yaw) * k;
  v.pitch += (h.pitch - v.pitch) * k;
  v.distance += (h.distance - v.distance) * k;
  v.zoom += (h.zoom - v.zoom) * k;
  v.fov += (h.fov - v.fov) * k;
  v.target = [v.target[0] + (h.target[0] - v.target[0]) * k, v.target[1] + (h.target[1] - v.target[1]) * k, v.target[2] + (h.target[2] - v.target[2]) * k];
  const done = Math.abs(angleDelta(v.yaw, h.yaw)) < 1e-3 && Math.abs(h.pitch - v.pitch) < 1e-3 && Math.abs(h.distance - v.distance) < 1e-3 && Math.abs(h.zoom - v.zoom) < 1e-3 && Math.abs(h.fov - v.fov) < 1e-2 && Math.hypot(h.target[0] - v.target[0], h.target[1] - v.target[1], h.target[2] - v.target[2]) < 1e-4;
  if (done) {
    rig.view = copyView(h);
    rig.framing = false;
  }
}

/** True when the view equals the preset (used by tests and by the "Reset view" button state). */
export function isAtHome(rig: CameraRig): boolean {
  const v = rig.view;
  const h = rig.home;
  return Math.abs(angleDelta(v.yaw, h.yaw)) < 1e-6 && Math.abs(v.pitch - h.pitch) < 1e-6 && Math.abs(v.distance - h.distance) < 1e-6 && Math.abs(v.zoom - h.zoom) < 1e-6 && v.target.every((x, i) => Math.abs(x - h.target[i]) < 1e-6);
}

/** The base preset seen from the front (yaw 0) or from the patient's right side (yaw -90 degrees). Used by the dev screen. */
export function presetFacing(base: CameraPreset, facing: 'front' | 'side'): CameraPreset {
  const v = viewFromPreset(base);
  const yaw = facing === 'front' ? 0 : -Math.PI / 2;
  const c = Math.cos(v.pitch);
  return { ...base, position: [base.target[0] + v.distance * Math.sin(yaw) * c, base.target[1] + v.distance * Math.sin(v.pitch), base.target[2] + v.distance * Math.cos(yaw) * c] };
}
