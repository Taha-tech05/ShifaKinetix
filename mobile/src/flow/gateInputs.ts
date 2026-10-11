// Structured inputs for the Severity Gate that come from the patient's other answers.
//
// The gate takes answers in the shared format {questionId, type, value, state}. Two things it must be able to see are not
// danger questions of their own, so they are derived here as proper answers (never as free text):
//   Q_ONSET_SUDDEN_TRAUMA   "Did it start suddenly or after an injury?"  from the basics answer (Q_BASICS_HOW)
//   Q_UNABLE_TO_MOVE_ARM    "Were you unable to lift or move the arm?"    from the movement results (unableToDo)
// Rules for these two ids are NOT defined here (the gate rules belong to Person A). Until a rule exists the gate simply
// does not react to them; once a rule names them, they are already in the right shape.
//
// "Not sure" and "Skip" stay unknown. An answer that was never given is absent, never false.
import type { Answer } from '../gate/evaluate';
import type { MovementResult } from '../store/session';

export const Q_ONSET_SUDDEN_TRAUMA = 'Q_ONSET_SUDDEN_TRAUMA';
export const Q_UNABLE_TO_MOVE_ARM = 'Q_UNABLE_TO_MOVE_ARM';
const Q_BASICS_HOW = 'Q_BASICS_HOW';
/** Answers of Q_BASICS_HOW that mean a sudden or injury-related start (placeholder, for the clinician to confirm). */
export const SUDDEN_OR_INJURY = ['after_injury', 'suddenly'];

export function structuredGateInputs(answers: Answer[], movementResults: MovementResult[]): Answer[] {
  const out: Answer[] = [];

  const how = answers.find((a) => a.questionId === Q_BASICS_HOW);
  if (how) {
    if (how.state === 'unknown') out.push({ questionId: Q_ONSET_SUDDEN_TRAUMA, type: 'yesno', value: null, state: 'unknown' });
    else out.push({ questionId: Q_ONSET_SUDDEN_TRAUMA, type: 'yesno', value: SUDDEN_OR_INJURY.includes(String(how.value)), state: 'answered' });
  }

  const answeredMoves = movementResults.filter((m) => m.state !== 'unknown');
  if (answeredMoves.some((m) => m.unableToDo)) {
    out.push({ questionId: Q_UNABLE_TO_MOVE_ARM, type: 'yesno', value: true, state: 'answered' });
  } else if (answeredMoves.length > 0) {
    out.push({ questionId: Q_UNABLE_TO_MOVE_ARM, type: 'yesno', value: false, state: 'answered' });
  } else if (movementResults.length > 0) {
    out.push({ questionId: Q_UNABLE_TO_MOVE_ARM, type: 'yesno', value: null, state: 'unknown' });
  }
  return out;
}
