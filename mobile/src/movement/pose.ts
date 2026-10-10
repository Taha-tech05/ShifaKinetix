// Pose at a time t (0 to 1) of a looping movement, by easing between keyframes. Pure, so it is easy to test.
// The animated mannequin interpolates the same keyframes with the same easing (see components/movement).
import type { Keyframe } from './movements';

export interface Pose {
  humerusDeg: number;
  elbowDeg: number;
  scapulaDeg: number;
  forearmRotationDeg: number;
}

/** Smooth ease in and out between two keyframes. */
export function ease(x: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * x);
}

export function poseAt(keyframes: Keyframe[], t: number): Pose {
  const k = keyframes.slice().sort((a, b) => a.t - b.t);
  const tt = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < k.length - 2 && tt > k[i + 1].t) i++;
  const a = k[i];
  const b = k[i + 1] ?? a;
  const span = b.t - a.t;
  const f = span > 0 ? ease((tt - a.t) / span) : 0;
  const mix = (x: number, y: number) => x + (y - x) * f;
  return {
    humerusDeg: mix(a.humerusDeg, b.humerusDeg),
    elbowDeg: mix(a.elbowDeg, b.elbowDeg),
    scapulaDeg: mix(a.scapulaDeg, b.scapulaDeg),
    forearmRotationDeg: mix(a.forearmRotationDeg ?? 0, b.forearmRotationDeg ?? 0),
  };
}
