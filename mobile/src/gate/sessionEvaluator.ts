import type { Answer, GateOutput } from './evaluate';
import { evaluateSessionGate, MOVEMENT_CONTEXT } from './sessionAdapter';
import { useSession } from '../store/session';
import type { MovementResult } from '../store/session';

/**
 * One-import bridge for B's synchronous runGate contract. The movement results travel with the answers so the adapter can
 * check, after the whole movement set, whether "I can move my arm" is contradicted. A skipped, weak or painful movement is
 * not a safety signal (contract v2); the name is kept for existing callers.
 */
export function withMovementUncertainty(answers: Answer[], movements: MovementResult[]): Answer[] {
  return [...answers, { questionId: MOVEMENT_CONTEXT, type: 'safety-context', state: 'answered', value: JSON.stringify(movements) }];
}

export function evaluateStoredSessionGate(answers: Answer[]): GateOutput {
  return evaluateSessionGate(withMovementUncertainty(answers, useSession.getState().movementResults));
}
