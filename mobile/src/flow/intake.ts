// Rules of the symptom-intake flow, as pure functions so they can be tested.
// Order: fork -> body (P5) -> confirm (P6) -> basics (P27) -> red-flag questions -> gate stub.
//   RED_FLAG -> urgent screen, the flow stops.  CLARIFY -> re-ask once, then "see a doctor" and the flow stops.
//   SAFE -> exact mode: follow-up questions -> result.  region mode: 6 movements -> follow-up questions -> result.
// Movements and narrowing are reachable ONLY after the verdict SAFE.
import type { Answer, Verdict } from '../gate/evaluate';
import { narrow } from '../dev/narrowingStub';
import type { NarrowingOutput } from '../dev/narrowingStub';
import { narrowingInputFrom } from '../store/session';
import type { SessionState } from '../store/session';
import type { IntakeMode } from '../regions/regionMap';

export type ForkChoice = 'exact' | 'region' | 'unsure';

export const FORK_QUESTION_ID = 'Q_FORK_POINT';

/** The fork answer. "Not sure" gives region mode and is stored as unknown, never as a yes or a no. */
export function forkResult(choice: ForkChoice): { mode: IntakeMode; answer: Answer } {
  if (choice === 'exact') {
    return { mode: 'exact', answer: { questionId: FORK_QUESTION_ID, type: 'chooseone', value: 'exact', state: 'answered' } };
  }
  if (choice === 'region') {
    return { mode: 'region', answer: { questionId: FORK_QUESTION_ID, type: 'chooseone', value: 'region', state: 'answered' } };
  }
  return { mode: 'region', answer: { questionId: FORK_QUESTION_ID, type: 'chooseone', value: null, state: 'unknown' } };
}

/** Movements and narrowing are allowed only after the gate said SAFE. */
export function isSafe(verdict: Verdict | null): boolean {
  return verdict === 'SAFE';
}

/** Where to go after the gate ran. `reaskDone` is true once the clarifying re-ask has been used. */
export function routeAfterGate(verdict: Verdict, reaskDone: boolean): string {
  if (verdict === 'RED_FLAG') return '/report/urgent';
  if (verdict === 'CLARIFY') return reaskDone ? '/report/unclear' : '/report/reask';
  return '/report/safe';
}

/** First step after SAFE. */
export function routeAfterSafe(mode: IntakeMode): string {
  return mode === 'exact' ? '/report/followup' : '/report/movement?i=0';
}

/** What comes after the follow-up questions. */
export const RESULT_ROUTE = '/report/result';

/** Number of guided movements (region mode). */
export const MOVEMENT_COUNT = 6;

/** Route for the step after the movement with index i. */
export function routeAfterMovement(i: number): string {
  return i + 1 < MOVEMENT_COUNT ? `/report/movement?i=${i + 1}` : '/report/followup';
}

/**
 * The only way to run the narrowing step: returns null unless the verdict is SAFE and a spot was chosen.
 * Screens call this, never narrow() directly.
 */
export function runNarrowing(state: Pick<SessionState, 'gateVerdict' | 'selection' | 'answers' | 'movementResults'>): NarrowingOutput | null {
  if (!isSafe(state.gateVerdict)) return null;
  const input = narrowingInputFrom(state);
  return input ? narrow(input) : null;
}

/** Confidence below this, or a cluster, makes the result suggest seeing a doctor. */
export const LOW_CONFIDENCE = 0.5;

export function suggestDoctor(out: NarrowingOutput): boolean {
  if (out.cluster) return true;
  const top = out.candidates[0];
  return !top || top.confidence < LOW_CONFIDENCE;
}
