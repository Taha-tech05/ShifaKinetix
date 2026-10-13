import type { Answer, GateOutput } from './evaluate';
import { evaluateSessionGate, MOVEMENT_CONTEXT } from './sessionAdapter';
import { useSession } from '../store/session';
import type { MovementResult } from '../store/session';

/** One-import bridge for B's synchronous runGate contract. */
export function withMovementUncertainty(answers: Answer[], movements: MovementResult[]): Answer[] {
  // B's combined inputs can hide a skipped movement when another was completed.
  // Restore uncertainty before evaluating; a positive signal still takes precedence.
  const uncertain: Answer[] = movements.some((m) => !['answered', 'done'].includes(m.state)) ? [
    { questionId: 'Q_UNABLE_TO_MOVE_ARM', type: 'yesno', value: null, state: 'unknown' },
    { questionId: 'Q_NUMB_OR_WEAK', type: 'yesno', value: null, state: 'unknown' },
  ] : [];
  return [...answers, ...uncertain, { questionId: MOVEMENT_CONTEXT, type: 'safety-context',
    state: 'answered', value: JSON.stringify(movements) }];
}

export function evaluateStoredSessionGate(answers: Answer[]): GateOutput {
  return evaluateSessionGate(withMovementUncertainty(answers, useSession.getState().movementResults));
}
