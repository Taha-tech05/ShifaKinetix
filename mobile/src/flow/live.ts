// The live flow: one movement or question at a time, with the narrowing and the Severity Gate run after EVERY answer.
//
// After each answer (a movement result or a discriminator answer, skips and "Not sure" included):
//   1. the answer is stored (state "unknown" for "Not sure" and "Skip", never turned into "no"),
//   2. the Severity Gate is run again through the existing interface (session.runGate), with the structured onset and
//      unable-to-move inputs (flow/gateInputs.ts). If the verdict is not SAFE the flow stops and routes where the existing
//      code routes (urgent, re-ask, unclear). No gate rule is added or changed here,
//   3. only on SAFE: the narrowing interface is called (narrow() through narrowing/live.ts), the live state is stored and
//      a snapshot of it is appended to the trail for the doctor view.
//
// The screens use the durable variants (submitMovementDurable, submitQuestionDurable, goBackDurable): they store the answer,
// then AWAIT the safety checkpoint (the answer and the movement are written to the saved intake and the gate is confirmed
// against what was saved), and only then run steps 2 and 3. If the write fails the flow stops at the safety check and no
// narrowing is computed, so an answer that is not saved can never lead to a result. The plain synchronous functions are kept
// for tests and the dev seeder, which have no saved intake.
import type { Answer, Verdict } from '../gate/evaluate';
import { discriminatorIds } from '../narrowing/bank';
import { NARROWING, STRUCTURE } from '../narrowing/config';
import { structureIds } from '../narrowing/structureBank';
import { SAFETY_DERIVED_IDS } from '../narrowing/safetyFacts';
import { evaluateLive, snapshotOf } from '../narrowing/live';
import type { LiveState } from '../narrowing/live';
import { MOVEMENTS } from '../movement/movements';
import type { HistoryEntry, MovementResult } from '../store/session';
import { narrowingInputFrom, useSession } from '../store/session';
import type { IntakeMode } from '../regions/regionMap';
import { openSafetySession } from '../gate/safetySession';
import { isSafe, RESULT_ROUTE, routeAfterGate } from './intake';

/** Where the flow goes when the answer could not be saved: the safety check, which confirms the saved answers again. */
export const PERSIST_FAILED_ROUTE = '/report/danger';

export type LiveStep = { kind: 'structure'; id: string } | { kind: 'movement'; id: string } | { kind: 'question'; id: string };

/**
 * Region mode (guided movements) starts with the six animated movements, then the structure-type questions, then the muscle
 * questions. Exact mode has no movements: structure-type questions, then the muscle questions. Muscles are shown only if
 * muscle or tendon leads after the structure-type questions.
 * The SOON care level (see a doctor in the next few days) keeps the questions but skips the physical movements. Structure-type
 * questions the safety check already answered (tingling, numbness) are not asked again.
 */
export function liveSteps(mode: IntakeMode): LiveStep[] {
  const structure: LiveStep[] = structureIds().filter((id) => !SAFETY_DERIVED_IDS.includes(id)).map((id) => ({ kind: 'structure', id }));
  const withMovements = mode === 'region' && !useSession.getState().movementsBlocked;
  const moves: LiveStep[] = withMovements ? MOVEMENTS.map((m) => ({ kind: 'movement', id: m.id })) : [];
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
  /** True when the answer could not be saved (durable variants only): nothing was narrowed and the flow stops. */
  persistFailed?: boolean;
}

/** Waits until the newest answer and movement are saved. Resolves to a stop outcome when they could not be saved, else null. */
async function checkpointOrStop(): Promise<LiveOutcome | null> {
  try {
    await (await openSafetySession()).checkpoint();
    return null;
  } catch {
    const verdict = useSession.getState().gateVerdict ?? 'CLARIFY';
    return { verdict, route: PERSIST_FAILED_ROUTE, state: null, persistFailed: true };
  }
}

function afterAnswer(afterId: string, answerLabel: string, seq?: number): LiveOutcome {
  const store = useSession.getState();
  const verdict = store.runGate();
  if (!isSafe(verdict)) {
    // The escalation is logged and stays: going back never undoes it.
    store.setEscalation({ verdict, afterId, at: new Date().toISOString() });
    return { verdict, route: routeAfterGate(verdict, store.reaskDone), state: null };
  }
  const input = narrowingInputFrom(useSession.getState());
  if (!input) return { verdict, route: null, state: null };
  const state = evaluateLive(input, store.mode ?? 'region');
  useSession.getState().recordNarrowing(snapshotOf(afterId, answerLabel, state, verdict, new Date(), { seq }));
  return { verdict, route: null, state };
}

/** A movement result: "Skip" and "Not sure" arrive here with state "unknown". */
export function submitMovement(result: MovementResult, label: string): LiveOutcome {
  const { text, seq } = storeMovement(result, label);
  return afterAnswer(result.movementId, text, seq);
}

function storeMovement(result: MovementResult, label: string) {
  const text = result.state === 'unknown' ? 'unknown' : label;
  const store = useSession.getState();
  const entry = store.logAnswer({ kind: 'movement', id: result.movementId, answer: null, movement: result, label: text });
  store.recordMovement(result);
  return { text, seq: entry.seq };
}

/** Like submitMovement, but the result is saved (awaited) before the gate and the narrowing run. */
export async function submitMovementDurable(result: MovementResult, label: string): Promise<LiveOutcome> {
  const { text, seq } = storeMovement(result, label);
  return (await checkpointOrStop()) ?? afterAnswer(result.movementId, text, seq);
}

/** A discriminator or structure-type answer: "Not sure" and "Skip" arrive here with state "unknown" and value null. */
export function submitQuestion(answer: Answer): LiveOutcome {
  const { text, seq } = storeQuestion(answer);
  return afterAnswer(answer.questionId, text, seq);
}

function storeQuestion(answer: Answer) {
  const text = answer.state === 'unknown' ? 'unknown' : answer.value === true ? 'yes' : 'no';
  const store = useSession.getState();
  const entry = store.logAnswer({ kind: 'question', id: answer.questionId, answer, movement: null, label: text });
  store.recordAnswer(answer);
  return { text, seq: entry.seq };
}

/** Like submitQuestion, but the answer is saved (awaited) before the gate and the narrowing run. */
export async function submitQuestionDurable(answer: Answer): Promise<LiveOutcome> {
  const { text, seq } = storeQuestion(answer);
  return (await checkpointOrStop()) ?? afterAnswer(answer.questionId, text, seq);
}

export interface BackResult {
  /** False when going back is not allowed (nothing to undo, or the gate escalated). */
  ok: boolean;
  reason?: 'empty' | 'escalated';
  /** The answer that was undone: the screen shows that question again. */
  undone?: HistoryEntry;
  /** Where to go instead (the recomputed state is a gate stop), or null. */
  route: string | null;
  state: LiveState | null;
}

/**
 * Back: the most recent active answer is superseded (kept in the log), everything is rebuilt from the answers that remain and
 * recomputed from scratch (the narrowing and the category scores are not adjusted step by step), and the Severity Gate is run
 * again on the full structured state. After an escalation back does nothing: the escalation stays.
 */
export function goBack(): BackResult {
  const rewound = rewind();
  return 'ok' in rewound ? rewound : finishBack(rewound.undone);
}

/** Like goBack, but the rewound answers are saved (awaited) before the gate and the narrowing run again. */
export async function goBackDurable(): Promise<BackResult> {
  const rewound = rewind();
  if ('ok' in rewound) return rewound;
  const stop = await checkpointOrStop();
  if (stop) return { ok: true, undone: rewound.undone, route: stop.route, state: null };
  return finishBack(rewound.undone);
}

/** Supersedes the last answer and rebuilds the session from the rest, or says why that is not allowed. */
function rewind(): BackResult | { undone: HistoryEntry } {
  const store = useSession.getState();
  if (store.escalation) return { ok: false, reason: 'escalated', route: null, state: null };
  const undone = store.supersedeLast();
  if (!undone) return { ok: false, reason: 'empty', route: null, state: null };
  useSession.getState().rebuildFromHistory();
  return { undone };
}

function finishBack(undone: HistoryEntry): BackResult {
  const after = useSession.getState();
  const verdict = after.runGate();
  if (!isSafe(verdict)) {
    after.setEscalation({ verdict, afterId: undone.id, at: new Date().toISOString() });
    return { ok: true, undone, route: routeAfterGate(verdict, after.reaskDone), state: null };
  }
  const input = narrowingInputFrom(useSession.getState());
  if (!input) return { ok: true, undone, route: null, state: null };
  const state = evaluateLive(input, after.mode ?? 'region');
  useSession.getState().recordNarrowing(snapshotOf(undone.id, 'back', state, verdict, new Date(), { recomputed: true }));
  return { ok: true, undone, route: null, state };
}

/** The live state before any answer: the possible muscles seeded from the tapped area. Nothing is stored. Null without a selection. */
export function seedLiveState(): LiveState | null {
  const store = useSession.getState();
  const input = narrowingInputFrom(store);
  return input ? evaluateLive(input, store.mode ?? 'region') : null;
}

/** The current answers in the order they were given (for "Review answers"). */
export function activeHistory(): HistoryEntry[] {
  return useSession.getState().history.filter((h) => !h.supersededAt);
}

/** Index of a movement or question in the steps of a mode, or -1. */
export function stepIndexOf(mode: IntakeMode, id: string): number {
  return liveSteps(mode).findIndex((st) => st.id === id);
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
