// Structured inputs for the Severity Gate that come from the patient's other answers.
//
// The gate takes answers in the shared format {questionId, type, value, state}. Some things it must be able to see are not
// danger questions of their own, so they are derived here as proper answers (never as free text):
//   Q_ONSET_SUDDEN_TRAUMA   "Did it start suddenly or after an injury?"  from the basics answer (Q_BASICS_HOW)
//   Q_UNABLE_TO_MOVE_ARM    "Were you unable to lift or move the arm?"    from the movement results (unableToDo)
//   Q_BONE_TENDER_AFTER_TRAUMA  a sore spot on a bone AND an injury or sudden start   from Q_ST_BONE_POINT and the onset
//   Q_NUMB_OR_WEAK          numbness, tingling or weakness                   from Q_ST_NUMB, Q_ST_TINGLE and a "weak" movement
// Rules for these ids are NOT defined here (the gate rules belong to Person A). Until a rule exists the gate simply
// does not react to them; once a rule names them, they are already in the right shape.
//
// "Not sure" and "Skip" stay unknown. An answer that was never given is absent, never false.
import type { Answer } from '../gate/evaluate';
import { BONE_POINT_ID, NUMB_ID, TINGLE_ID } from '../narrowing/structureBank';
import type { MovementResult } from '../store/session';

export const Q_ONSET_SUDDEN_TRAUMA = 'Q_ONSET_SUDDEN_TRAUMA';
export const Q_UNABLE_TO_MOVE_ARM = 'Q_UNABLE_TO_MOVE_ARM';
export const Q_BONE_TENDER_AFTER_TRAUMA = 'Q_BONE_TENDER_AFTER_TRAUMA';
export const Q_NUMB_OR_WEAK = 'Q_NUMB_OR_WEAK';
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

  // A sore spot on a bone after an injury: yes only when both are yes; no when either is a real no; otherwise unknown.
  const bone = answers.find((a) => a.questionId === BONE_POINT_ID);
  const trauma = out.find((a) => a.questionId === Q_ONSET_SUDDEN_TRAUMA);
  if (bone) {
    const boneYes = bone.state === 'answered' && bone.value === true;
    const boneNo = bone.state === 'answered' && bone.value === false;
    const traumaYes = trauma?.state === 'answered' && trauma.value === true;
    const traumaNo = trauma?.state === 'answered' && trauma.value === false;
    if (boneYes && traumaYes) out.push({ questionId: Q_BONE_TENDER_AFTER_TRAUMA, type: 'yesno', value: true, state: 'answered' });
    else if (boneNo || traumaNo) out.push({ questionId: Q_BONE_TENDER_AFTER_TRAUMA, type: 'yesno', value: false, state: 'answered' });
    else out.push({ questionId: Q_BONE_TENDER_AFTER_TRAUMA, type: 'yesno', value: null, state: 'unknown' });
  }

  // Numbness, tingling or weakness: yes from any one; no only when the numbness and tingling answers are real noes and no
  // movement was weak; unknown when the questions were skipped; absent when none was asked.
  const sensory = [TINGLE_ID, NUMB_ID].map((id) => answers.find((a) => a.questionId === id)).filter((a): a is Answer => !!a);
  const weakMove = answeredMoves.some((m) => m.weak);
  if (sensory.some((a) => a.state === 'answered' && a.value === true) || weakMove) {
    out.push({ questionId: Q_NUMB_OR_WEAK, type: 'yesno', value: true, state: 'answered' });
  } else if (sensory.length > 0 && sensory.every((a) => a.state === 'answered' && a.value === false)) {
    out.push({ questionId: Q_NUMB_OR_WEAK, type: 'yesno', value: false, state: 'answered' });
  } else if (sensory.length > 0) {
    out.push({ questionId: Q_NUMB_OR_WEAK, type: 'yesno', value: null, state: 'unknown' });
  }
  return out;
}
