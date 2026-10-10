// Guided shoulder movements (data in src/data/movements_shoulder.json). Draft, awaiting clinician review.
import { getLanguage } from '../i18n';
import type { Language } from '../i18n';
import data from '../data/movements_shoulder.json';

type Localized = { en: string; ur: string; roman: string };

export interface Keyframe {
  name: 'start' | 'peak' | 'return';
  /** Position in the loop, 0 to 1. */
  t: number;
  /** Upper arm angle. Positive is up (sideways or forward), negative is backward. */
  humerusDeg: number;
  /** Elbow bend. */
  elbowDeg: number;
  /** Shoulder-blade rotation: (humerusDeg - 30) / 3 above 30 degrees, else 0. */
  scapulaDeg: number;
  /** Schematic outward swing of the forearm (outward push only). */
  forearmRotationDeg?: number;
}

export interface Movement {
  id: string;
  order: number;
  region: string;
  name: Localized;
  view: 'front' | 'side';
  keyframes: Keyframe[];
  valueNote: string;
  instruction: Localized;
  caution: Localized;
  cameraMeasurable: boolean;
  sources: string[];
  review: string;
  /** "behind": the forearm folds backward (hand behind back). Default: forward. */
  elbowDirection?: 'behind';
}

export const MOVEMENTS = (data.movements as unknown as Movement[]).slice().sort((a, b) => a.order - b.order);
export const MOVEMENTS_LABEL = data.label;
export const SCAPULA_RULE = data.scapulaRule;

/** Required caution line, English. Shown on every movement screen. */
export const CAUTION_EN = 'Move only as far as comfortable. Stop if pain is sharp or severe.';

export function localized(text: Localized, lang: Language = getLanguage()): string {
  return text[lang] ?? text.en;
}

export function movementById(id: string): Movement | undefined {
  return MOVEMENTS.find((m) => m.id === id);
}

/** Shoulder-blade rotation for an arm angle: one third of the elevation after the first 30 degrees. */
export function scapulaFor(humerusDeg: number): number {
  return humerusDeg > 30 ? Math.round(((humerusDeg - 30) / 3) * 10) / 10 : 0;
}

/** Demo limits: the animation never goes past these (not norms; typical value, confirm with physio). */
export const COMFORT_LIMITS = { humerusMin: -45, humerusMax: 135, elbowMax: 120, forearmRotationMax: 40 };

/** One loop of the demo animation, in milliseconds (slow on purpose). */
export const LOOP_MS = 4000;
