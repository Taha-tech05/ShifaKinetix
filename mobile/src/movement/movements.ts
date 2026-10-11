// Guided shoulder movements (data in src/data/movements_shoulder.json).
// The numbers are TEST VALUES for checking the animation ("test values, replace with researched data"), not research.
// Patient-facing text stays "draft, awaiting clinician review".
import { getLanguage } from '../i18n';
import type { Language } from '../i18n';
import type { CameraPreset } from '../components/body3d/cameraRig';
import data from '../data/movements_shoulder.json';

type Localized = { en: string; ur: string; roman: string };
type Range = [number, number];

/** One frame of a movement. t is the fraction of the loop (0 to 1); two equal frames in a row are a hold. */
export interface Frame {
  t: number;
  /** Upper arm angle from the model's rest pose, positive = up, negative = backward. */
  elevation: number;
  /** Direction of elevation: 0 = side, 90 = forward, 30 = scapular plane. */
  plane: number;
  /** Rotation about the upper arm's long axis, positive = external (outward). */
  rotation: number;
  /** Elbow flexion, 0 = straight. */
  elbow: number;
}

export interface ResistArrow {
  segment: 'forearm' | 'hand';
  direction: 'down' | 'inward' | 'toward trunk';
  /** Loop fractions during which the arrow shows. */
  during: [number, number];
}

export interface Movement {
  id: string;
  order: number;
  region: string;
  name: Localized;
  view: 'front' | 'side';
  allowed: { elevation?: Range; rotation?: Range; elbow?: Range };
  frames: Frame[];
  loopSeconds: number;
  suggests: string[];
  /** Ids in shared/regions_shoulder.json of the structures named in "suggests" (test values). */
  suggestsStructures: string[];
  resistArrow: ResistArrow | null;
  cameraMeasurable: boolean;
  /** Camera preset for the RIGHT side (position, target, fov, zoom). The left side mirrors x. Placeholder framing. */
  camera: CameraPreset;
  /** Seconds of the move out, the hold at the end pose and the return (the loop is their sum). */
  timing?: { outSeconds: number; holdSeconds: number; returnSeconds: number };
  valuesLabel: string;
  instruction: Localized;
  caution: Localized;
  sources: string[];
  review: string;
}

export const MOVEMENTS = (data.movements as unknown as Movement[]).slice().sort((a, b) => a.order - b.order);
export const MOVEMENTS_LABEL = data.label;
export const VALUES_LABEL = data.valuesLabel;
export const SCAPULA_RULE = data.scapulaRule;
export const DEFAULT_LOOP_SECONDS = data.defaultLoopSeconds;

/** Required caution line, English. Shown on every movement screen. */
export const CAUTION_EN = 'Move only as far as comfortable. Stop if pain is sharp or severe.';

export function localized(text: Localized, lang: Language = getLanguage()): string {
  return text[lang] ?? text.en;
}

export function movementById(id: string): Movement | undefined {
  return MOVEMENTS.find((m) => m.id === id);
}

/** Shoulder-blade rotation for an arm elevation: one third of the elevation after the first 30 degrees, 0 below. */
export function scapulaFor(elevation: number): number {
  return elevation > 30 ? (elevation - 30) / 3 : 0;
}

/** Frames (and channels) that fall outside the "allowed" ranges of the movement. Empty when all are inside. */
export function allowedViolations(m: Movement): string[] {
  const out: string[] = [];
  const check = (name: 'elevation' | 'rotation' | 'elbow', f: Frame) => {
    const r = m.allowed[name];
    if (r && (f[name] < r[0] || f[name] > r[1])) out.push(`${name} ${f[name]} at t=${f.t} is outside [${r[0]}, ${r[1]}]`);
  };
  for (const f of m.frames) (['elevation', 'rotation', 'elbow'] as const).forEach((n) => check(n, f));
  return out;
}

export function framesWithinAllowed(m: Movement): boolean {
  return allowedViolations(m).length === 0;
}

// ---- schematic mannequin (fallback) ----
export interface MannequinKeyframe {
  t: number;
  humerusDeg: number;
  elbowDeg: number;
  scapulaDeg: number;
  forearmRotationDeg: number;
}

/** The 2D mannequin only knows arm angle, elbow and a schematic outward swing, so it uses part of each frame. */
export function mannequinKeyframes(m: Movement): MannequinKeyframe[] {
  return m.frames.map((f) => ({
    t: f.t,
    humerusDeg: f.elevation,
    elbowDeg: f.elbow,
    scapulaDeg: scapulaFor(f.elevation),
    forearmRotationDeg: m.id === 'outward_push_elbow_at_side' ? f.rotation : 0,
  }));
}
