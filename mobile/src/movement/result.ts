// Movement result in the agreed format (shared/formats.md, format 3):
// {movementId, painful, weak, unableToDo, measuredAngle, state}.
// "Not sure" and "Skip" give state "unknown". The booleans are then false only because there is no answer, so anything
// that reads a result must check state first: unknown is never the same as "no".
import type { MovementResult } from '../store/session';

export type Feel =
  | { kind: 'skip' }
  | { kind: 'unsure' }
  | { kind: 'felt'; pain: boolean; weak: boolean; couldNot: boolean };

export function buildMovementResult(movementId: string, feel: Feel): MovementResult {
  if (feel.kind === 'felt') {
    return { movementId, painful: feel.pain, weak: feel.weak, unableToDo: feel.couldNot, measuredAngle: null, state: 'answered' };
  }
  return { movementId, painful: false, weak: false, unableToDo: false, measuredAngle: null, state: 'unknown' };
}

/** Camera measurement is not built yet. The placeholder result says so: unknown, answer yourself. */
export const CAMERA_PLACEHOLDER_STATE = 'unknown, answer yourself';
