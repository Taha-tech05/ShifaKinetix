// The live flow: one movement or question at a time, with the narrowing and the Severity Gate run after EVERY answer.
//
// After each answer (a movement result or a discriminator answer, skips and "Not sure" included):
//   1. the answer is stored (state "unknown" for "Not sure" and "Skip", never turned into "no"),
//   2. the Severity Gate is run again through the existing interface (session.runGate), with the structured onset and
//      unable-to-move inputs (flow/gateInputs.ts). If the verdict is not SAFE the flow stops and routes where the existing
//      code routes (urgent, re-ask, unclear). No gate rule is added or changed here,
//   3. only on SAFE: the narrowing interface is called (narrow() through narrowing/live.ts), the live state is stored and
//      a snapshot of it is appended to the trail for the doctor view.
import type { Answer, Verdict } from '../gate/evaluate';
import { discriminatorIds } from '../narrowing/bank';
import { NARROWING, STRUCTURE } from '../narrowing/config';
import { structureIds } from '../narrowing/structureBank';
import { evaluateLive, snapshotOf } from '../narrowing/live';
import type { LiveState } from '../narrowing/live';
import { MOVEMENTS } from '../movement/movements';
import type { MovementResult } from '../store/session';
import { narrowingInputFrom, useSession } from '../store/session';
import type { IntakeMode } from '../regions/regionMap';
import { isSafe, RESULT_ROUTE, routeAfterGate } from './intake';

export type LiveStep = { kind: 'structure'; id: string } | { kind: 'movement'; id: string } | { kind: 'question'; id: string };

/**
 * Region mode (guided movements) starts with the six animated movements, then the structure-type questions, then the muscle
 * questions. Exact mode has no movements: structure-type questions, then the muscle questions. Muscles are shown only if
 * muscle or tendon leads after the structure-type questions.
 */
export function liveSteps(mode: IntakeMode): LiveStep[] {
  const structure: LiveStep[] = structureIds().map((id) => ({ kind: 'structure', id }));
  const moves: LiveStep[] = mode === 'region' ? MOVEMENTS.map((m) => ({ kind: 'movement', id: m.id })) : [];
  return [...moves, ...structure, ...discriminatorIds().map((id): LiveStep => ({ kind: 'question', id }))];
}

/** The first step that has no answer yet (so coming back to the screen continues where the patient left off). */
export function firstOpenStep(steps: LiveStep[], movementIds: string[], questionIds: string[], skipStructure = false): number {
  const asked = new Set([...movementIds, ...questionIds]);
  const i = steps.findIndex((st) => !asked.has(st.id) && !(skipStructure && st.kind === 'structure'));
  return i === -1 ? steps.length - 1 : i;
}

/** Steps that can still be asked: never more than the caps (structure-type questions and muscle questions each have one). */
export function totalSteps(mode: IntakeMode): number {
  const steps = liveSteps(mode);
  const structure = steps.filter((st) => st.kind === 'structure').length;
  return Math.min(STRUCTURE.maxQuestions, structure) + Math.min(NARROWING.maxQuestions, steps.length - structure);
}

/** Index of the first muscle question: the first step after the movements and the structure-type questions. */
export function firstMuscleStep(mode: IntakeMode): number {
  return liveSteps(mode).findIndex((st) => st.kind === 'question');
}

export interface LiveOutcome {
  verdict: Verdict;
  /** Where to go instead of continuing (the gate stopped the flow), or null. */
  route: string | null;
  state: LiveState | null;
}

function afterAnswer(afterId: string, answerLabel: string): LiveOutcome {
  const store = useSession.getState();
  const verdict = store.runGate();
  if (!isSafe(verdict)) return { verdict, route: routeAfterGate(verdict, store.reaskDone), state: null };
  const input = narrowingInputFrom(useSession.getState());
  if (!input) return { verdict, route: null, state: null };
  const state = evaluateLive(input);
  useSession.getState().recordNarrowing(snapshotOf(afterId, answerLabel, state, verdict));
  return { verdict, route: null, state };
}

/** A movement result: "Skip" and "Not sure" arrive here with state "unknown". */
export function submitMovement(result: MovementResult, label: string): LiveOutcome {
  useSession.getState().recordMovement(result);
  return afterAnswer(result.movementId, result.state === 'unknown' ? 'unknown' : label);
}

/** A discriminator answer: "Not sure" and "Skip" arrive here with state "unknown" and value null. */
export function submitQuestion(answer: Answer): LiveOutcome {
  useSession.getState().recordAnswer(answer);
  return afterAnswer(answer.questionId, answer.state === 'unknown' ? 'unknown' : answer.value === true ? 'yes' : 'no');
}

/**
 * After an outcome with no stop: the index of the next step, or null when there is none or the flow should end.
 * The movements come first (region mode), then the structure-type questions. Once muscle or tendon leads, the structure-type
 * questions that are left are skipped and the muscle questions follow.
 */
export function nextStepIndex(mode: IntakeMode, current: number, outcome: LiveOutcome): number | null {
  if (outcome.route) return null;
  if (outcome.state?.stop) return null;
  const steps = liveSteps(mode);
  const here = steps[current];
  let next = current + 1;
  if (here?.kind === 'structure' && outcome.state?.muscleAllowed) next = firstMuscleStep(mode);
  if (next < 0 || next >= steps.length) return null;
  return next;
}

export const LIVE_RESULT_ROUTE = RESULT_ROUTE;
