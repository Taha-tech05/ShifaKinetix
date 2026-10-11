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
import { NARROWING } from '../narrowing/config';
import { evaluateLive, snapshotOf } from '../narrowing/live';
import type { LiveState } from '../narrowing/live';
import { MOVEMENTS } from '../movement/movements';
import type { MovementResult } from '../store/session';
import { narrowingInputFrom, useSession } from '../store/session';
import type { IntakeMode } from '../regions/regionMap';
import { isSafe, RESULT_ROUTE, routeAfterGate } from './intake';

export type LiveStep = { kind: 'movement'; id: string } | { kind: 'question'; id: string };

/** The steps in order: region mode asks the six movements and then the questions; exact mode asks only the questions. */
export function liveSteps(mode: IntakeMode): LiveStep[] {
  const moves: LiveStep[] = mode === 'region' ? MOVEMENTS.map((m) => ({ kind: 'movement', id: m.id })) : [];
  return [...moves, ...discriminatorIds().map((id): LiveStep => ({ kind: 'question', id }))];
}

/** The first step that has no answer yet (so coming back to the screen continues where the patient left off). */
export function firstOpenStep(steps: LiveStep[], movementIds: string[], questionIds: string[]): number {
  const asked = new Set([...movementIds, ...questionIds]);
  const i = steps.findIndex((st) => !asked.has(st.id));
  return i === -1 ? steps.length - 1 : i;
}

/** Steps that can still be asked: never more than the cap in total. */
export function totalSteps(mode: IntakeMode): number {
  return Math.min(NARROWING.maxQuestions, liveSteps(mode).length);
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

/** After an outcome with no stop: the index of the next step, or null when there is none or the flow should end. */
export function nextStepIndex(mode: IntakeMode, current: number, outcome: LiveOutcome): number | null {
  if (outcome.route) return null;
  if (outcome.state?.stop) return null;
  const next = current + 1;
  return next < totalSteps(mode) ? next : null;
}

export const LIVE_RESULT_ROUTE = RESULT_ROUTE;
