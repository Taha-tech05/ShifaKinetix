// Pose of a movement at a time t (0 to 1 of the loop). Pure, so it is easy to test.
// Between two different frames the angles move with a smooth start and stop (see easeTrap); between two equal frames
// (a hold) nothing moves at all.
import { scapulaFor } from './movements';
import type { Frame, Movement } from './movements';

export interface Pose {
  elevation: number;
  plane: number;
  rotation: number;
  elbow: number;
  /** Shoulder-blade (girdle) rotation, from the elevation by the scapula rule. */
  scapula: number;
}

/** Fraction of each move spent speeding up, and the same slowing down. Smaller = faster peak, larger = slower. */
export const RAMP = 0.15;

/**
 * Position (0 to 1) for progress x (0 to 1) with a velocity that ramps up with a half cosine, cruises, and ramps down.
 * Peak speed is 1 / (1 - RAMP) of the average speed (1.18x), start and end speeds are zero, and the acceleration is
 * continuous. The speed limit in the tests depends on this shape.
 */
export function easeTrap(x: number, r: number = RAMP): number {
  const t = Math.min(1, Math.max(0, x));
  const v = 1 / (1 - r); // peak velocity so the total distance is 1
  if (t < r) return v * (t / 2 - (r / (2 * Math.PI)) * Math.sin((Math.PI * t) / r));
  if (t <= 1 - r) return v * (r / 2 + (t - r));
  const u = 1 - t; // mirror image of the start
  return 1 - v * (u / 2 - (r / (2 * Math.PI)) * Math.sin((Math.PI * u) / r));
}

const same = (a: Frame, b: Frame) => a.elevation === b.elevation && a.plane === b.plane && a.rotation === b.rotation && a.elbow === b.elbow;

function poseOf(f: Pick<Frame, 'elevation' | 'plane' | 'rotation' | 'elbow'>): Pose {
  return { elevation: f.elevation, plane: f.plane, rotation: f.rotation, elbow: f.elbow, scapula: scapulaFor(f.elevation) };
}

export function poseAt(m: Pick<Movement, 'frames'>, t: number): Pose {
  const k = m.frames;
  const tt = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < k.length - 2 && tt > k[i + 1].t) i++;
  const a = k[i];
  const b = k[i + 1] ?? a;
  if (same(a, b)) return poseOf(a); // hold: exactly still
  const span = b.t - a.t;
  const f = span > 0 ? easeTrap((tt - a.t) / span) : 1;
  const mix = (x: number, y: number) => x + (y - x) * f;
  return poseOf({ elevation: mix(a.elevation, b.elevation), plane: mix(a.plane, b.plane), rotation: mix(a.rotation, b.rotation), elbow: mix(a.elbow, b.elbow) });
}

/** The rest pose: the first frame of the movement. */
export function restPose(m: Pick<Movement, 'frames'>): Pose {
  return poseOf(m.frames[0]);
}
