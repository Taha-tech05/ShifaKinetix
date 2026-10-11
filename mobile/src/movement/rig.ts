// Rigid-segment rig of the right arm: which pivot turns which segment. Pure math (no three.js), so it can be tested.
//
// Segments (data in src/data/arm_rig.json, built from the mesh by scripts/build-arm-rig.mjs):
//   trunk    everything else, including the whole left side. Never moves.
//   girdle   right scapula and clavicle (and what lies on them). Turns about the sternoclavicular joint by the scapula rule.
//   upper    right humerus and the muscles on it. Turns about the humeral head, which is carried by the girdle.
//   forearm  elbow, forearm and hand (no wrist motion). Turns about the elbow, which is carried by the upper arm.
//
// Axes (from the mesh): +y up, +z forward, +x the patient's left (the right arm is on -x). Units: metres.
// Matrices are 4x4, column-major like three.js. Angles are degrees in the data and radians in the math below.
import rigData from '../data/arm_rig.json';
import rigLeftData from '../data/arm_rig_left.json';
import type { Pose } from './pose';

export type Vec3 = [number, number, number];
export type Mat4 = number[];

export interface ArmRig {
  /** Which arm this rig is for. Missing means the right arm. */
  side?: 'right' | 'left';
  axes: unknown;
  pivots: {
    humeralHead: Vec3;
    glenoid: Vec3;
    elbow: Vec3;
    wrist: Vec3;
    sternoclavicular: Vec3;
    elbowFlexionAxisHorizontal: Vec3;
    upperArmAxisHanging: Vec3;
    headToGlenoid: number;
  };
  segments: { girdle: string[]; upper: string[]; forearm: string[]; hand: string[] };
}

export const ARM_RIG = rigData as unknown as ArmRig;
/** The left arm, computed from the left meshes by the same script (scripts/build-arm-rig.mjs left). */
export const ARM_RIG_LEFT = rigLeftData as unknown as ArmRig;

export type Side = 'right' | 'left';
export const rigFor = (side: Side): ArmRig => (side === 'left' ? ARM_RIG_LEFT : ARM_RIG);

// ---- small vector and matrix helpers ----
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const rad = (deg: number) => (deg * Math.PI) / 180;

export const identity = (): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function mul(a: Mat4, b: Mat4): Mat4 {
  const o = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
export const translation = (v: Vec3): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, v[0], v[1], v[2], 1];
/** Rotation by `angle` radians about the unit `axis` (right-hand rule). */
export function rotation(axis: Vec3, angle: number): Mat4 {
  const [x, y, z] = unit(axis);
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  return [
    t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0,
    t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0,
    t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0,
    0, 0, 0, 1,
  ];
}
export function apply(m: Mat4, p: Vec3): Vec3 {
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}
/** Rotate a direction (no translation). */
export function applyDir(m: Mat4, d: Vec3): Vec3 {
  return [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]];
}
/** Turn `m` about a pivot: T(p) m T(-p). */
export function aboutPivot(m: Mat4, pivot: Vec3): Mat4 {
  return mul(translation(pivot), mul(m, translation([-pivot[0], -pivot[1], -pivot[2]])));
}

// ---- axes and sign conventions ----
export interface ArmAxes {
  /** Direction of the upper arm at rest, from the humeral head to the elbow. */
  rest: Vec3;
  /** Axis the girdle turns about (positive = upward rotation: the glenoid rises). Perpendicular to the scapular plane. */
  scapularAxis: Vec3;
  /** Elbow flexion axis: positive flexion swings the forearm forward (+z) when the arm hangs. */
  elbowAxis: Vec3;
}

export function armAxes(rig: ArmRig = ARM_RIG): ArmAxes {
  const p = rig.pivots;
  const rest = unit(sub(p.elbow, p.humeralHead));
  const down: Vec3 = [0, -1, 0];
  const scapularPlane: Vec3 = [-Math.cos(rad(30)), 0, Math.sin(rad(30))]; // 30 degrees in front of the side
  const scapularAxis = unit(cross(down, scapularPlane));
  // Epicondylar axis from the mesh. Flip it so that positive flexion swings the forearm forward.
  let elbowAxis = unit(p.elbowFlexionAxisHorizontal);
  const forearmRest = unit(sub(p.wrist, p.elbow));
  if (cross(elbowAxis, forearmRest)[2] < 0) elbowAxis = [-elbowAxis[0], -elbowAxis[1], -elbowAxis[2]];
  return { rest, scapularAxis, elbowAxis };
}

/**
 * Direction the arm swings towards for an elevation plane (0 = side, 90 = forward), perpendicular to the rest axis.
 * A negative elevation swings the arm the opposite way: plane 90 is straight backward (extension), plane 0 is inward
 * (adduction, towards the midline), and planes in between are backward and inward together.
 */
export function elevationDirection(plane: number, elevation: number, rest: Vec3): Vec3 {
  const sign = elevation < 0 ? -1 : 1;
  const horizontal: Vec3 = [-Math.cos(rad(plane)) * sign, 0, Math.sin(rad(plane)) * sign];
  const along = dot(horizontal, rest);
  return unit([horizontal[0] - along * rest[0], horizontal[1] - along * rest[1], horizontal[2] - along * rest[2]]);
}

const flipX = (v: Vec3): Vec3 => [v[0] === 0 ? 0 : -v[0], v[1], v[2]];

/** Reflect a 4x4 matrix across the plane x = 0: S M S. */
export function reflectX(m: Mat4): Mat4 {
  const o = m.slice();
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) if ((r === 0) !== (c === 0)) o[c * 4 + r] = -m[c * 4 + r];
  return o;
}

const mirrored = new WeakMap<ArmRig, ArmRig>();
/** The rig with every point and axis reflected across x = 0, so a left arm looks like a right arm. */
export function mirrorRig(rig: ArmRig): ArmRig {
  const cached = mirrored.get(rig);
  if (cached) return cached;
  const p = rig.pivots;
  const m: ArmRig = {
    ...rig,
    side: 'right',
    pivots: {
      ...p,
      humeralHead: flipX(p.humeralHead),
      glenoid: flipX(p.glenoid),
      elbow: flipX(p.elbow),
      wrist: flipX(p.wrist),
      sternoclavicular: flipX(p.sternoclavicular),
      elbowFlexionAxisHorizontal: flipX(p.elbowFlexionAxisHorizontal),
      upperArmAxisHanging: flipX(p.upperArmAxisHanging),
    },
  };
  mirrored.set(rig, m);
  return m;
}

export interface ArmTransforms {
  girdle: Mat4;
  upper: Mat4;
  forearm: Mat4;
}

/**
 * Transform of each moving segment for a pose (rest-pose coordinates in, posed coordinates out).
 *   girdle  = T(sc) R(scapular axis, scapula) T(-sc)
 *   upper   = girdle * about the humeral head [ R(elevation axis, elevation) * R(rest axis, rotation) ]
 *   forearm = upper * about the elbow [ R(elbow axis, elbow) ]
 * so the humeral head stays on the glenoid (both ride on the girdle) and the forearm follows the upper arm.
 */
export function armTransforms(pose: Pose, rig: ArmRig = ARM_RIG): ArmTransforms {
  // The maths below is written for the right arm. The left arm is its mirror image: compute with the pivots mirrored in x
  // (a right-like arm), then reflect every matrix back (S M S with S = diag(-1, 1, 1)).
  if (rig.side === 'left') {
    const t = armTransformsRight(pose, mirrorRig(rig));
    return { girdle: reflectX(t.girdle), upper: reflectX(t.upper), forearm: reflectX(t.forearm) };
  }
  return armTransformsRight(pose, rig);
}

function armTransformsRight(pose: Pose, rig: ArmRig): ArmTransforms {
  const p = rig.pivots;
  const ax = armAxes(rig);
  const girdle = aboutPivot(rotation(ax.scapularAxis, rad(pose.scapula)), p.sternoclavicular);
  const u = elevationDirection(pose.plane, pose.elevation, ax.rest);
  const elevAxis = unit(cross(ax.rest, u));
  const q = mul(rotation(elevAxis, rad(Math.abs(pose.elevation))), rotation(ax.rest, rad(pose.rotation)));
  const upper = mul(girdle, aboutPivot(q, p.humeralHead));
  const forearm = mul(upper, aboutPivot(rotation(ax.elbowAxis, rad(pose.elbow)), p.elbow));
  return { girdle, upper, forearm };
}

/** Where the moving pivots and the glenoid are for a pose (for readouts and the joint-gap check). */
export function jointPositions(pose: Pose, rig: ArmRig = ARM_RIG) {
  const t = armTransforms(pose, rig);
  return {
    humeralHead: apply(t.upper, rig.pivots.humeralHead),
    glenoid: apply(t.girdle, rig.pivots.glenoid),
    elbow: apply(t.forearm, rig.pivots.elbow),
    wrist: apply(t.forearm, rig.pivots.wrist),
  };
}

/** World direction of a resist arrow. "inward" is towards the midline for the right arm. */
export function arrowDirection(direction: 'down' | 'inward' | 'toward trunk', side: Side = 'right'): Vec3 {
  const d: Vec3 = direction === 'down' ? [0, -1, 0] : direction === 'inward' ? [1, 0, 0] : [0, 0, -1];
  return side === 'left' ? flipX(d) : d;
}

export const lengthOf = len;
export const sub3 = sub;
