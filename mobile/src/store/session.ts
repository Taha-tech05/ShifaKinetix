import { create } from 'zustand';
import type { Answer, GateOutput, Verdict } from '../gate/evaluate';
import { evaluateStub } from '../gate/stub';
import { structuredGateInputs } from '../flow/gateInputs';
import type { LiveState, NarrowingSnapshot } from '../narrowing/live';
import { depthAnswerFrom } from '../dev/followUpQuestions';
import type { NarrowingInput } from '../dev/narrowingStub';
import { isDiscriminator } from '../narrowing/bank';
import { isStructureQuestion } from '../narrowing/structureBank';
import type { IntakeMode } from '../regions/regionMap';
import type { BodySelection } from '../regions/types';

export type { Point3D } from '../regions/types';

/** Shared format 3: movement result. */
export interface MovementResult {
  movementId: string;
  painful: boolean;
  weak: boolean;
  unableToDo: boolean;
  measuredAngle: number | null;
  state: string;
}

/**
 * One entry of the ordered answer history of the live flow. Nothing is deleted: an answer that is changed or undone stays in the
 * log with `supersededAt` set, so a doctor view can see what the patient first said. The active entries (no `supersededAt`) are
 * the current answers.
 */
export interface HistoryEntry {
  /** 1, 2, 3, ... in the order the answers were given. */
  seq: number;
  kind: 'movement' | 'question';
  /** movementId or questionId. */
  id: string;
  /** The answer in the shared format (questions). state "unknown" for "Not sure" and "Skip". */
  answer: Answer | null;
  /** The movement result (movements). */
  movement: MovementResult | null;
  /** A short label of the answer ("yes", "no", "unknown", "pain", ...). */
  label: string;
  at: string;
  /** Set when the answer was changed or undone. */
  supersededAt?: string;
}

/** A gate verdict other than SAFE that stopped the flow. It stays logged: going back never undoes it. */
export interface Escalation {
  verdict: Verdict;
  afterId: string;
  at: string;
}

export interface SessionState {
  /** What the patient tapped on the body: side, sub-region, point, closest structure and layer. */
  /** "exact" when the patient can point to the spot, "region" for the whole area (also when not sure). */
  mode: IntakeMode | null;
  selection: BodySelection | null;
  answers: Answer[];
  /** The complete evaluator result of the last run: { verdict, firedRules }. Null until the gate has run, and again after any answer changes. */
  gateOutput: GateOutput | null;
  /** Always the verdict of `gateOutput` (null when it is null). A SAFE verdict never outlives a changed answer. */
  gateVerdict: Verdict | null;
  /** True once the clarifying re-ask has been used (it is offered only once). */
  reaskDone: boolean;
  movementResults: MovementResult[];
  /** What the live strip last showed. The result screen shows exactly this (it does not compute again). */
  liveState: LiveState | null;
  /** One snapshot per answer, in order, so a doctor view can later show how the ranking evolved. */
  narrowingTrail: NarrowingSnapshot[];
  /** Ordered answer history of the live flow, with superseded answers kept (audit trail). */
  history: HistoryEntry[];
  /** Set when the gate escalated during the live flow. */
  escalation: Escalation | null;

  setMode: (mode: IntakeMode | null) => void;
  setReaskDone: (done: boolean) => void;
  setSelection: (selection: BodySelection | null) => void;
  /** Adds an answer, replacing any earlier answer to the same question. */
  recordAnswer: (answer: Answer) => void;
  runGate: () => Verdict;
  recordMovement: (result: MovementResult) => void;
  /** Stores the live state and appends the snapshot of this step. */
  recordNarrowing: (snapshot: NarrowingSnapshot) => void;
  /** Appends an answer to the history; an active entry for the same question is superseded first. Returns the new entry. */
  logAnswer: (entry: Pick<HistoryEntry, 'kind' | 'id' | 'answer' | 'movement' | 'label'>) => HistoryEntry;
  /** Marks the most recent active entry (and its snapshots) as superseded and returns it, or null if there is none. */
  supersedeLast: () => HistoryEntry | null;
  /** Rebuilds `answers` and `movementResults` from the active history entries (other answers, such as the basics, are kept). */
  rebuildFromHistory: () => void;
  setEscalation: (e: Escalation) => void;
  reset: () => void;
}

const initial = {
  mode: null,
  selection: null,
  answers: [] as Answer[],
  gateOutput: null as GateOutput | null,
  gateVerdict: null as Verdict | null,
  reaskDone: false,
  movementResults: [] as MovementResult[],
  liveState: null as LiveState | null,
  narrowingTrail: [] as NarrowingSnapshot[],
  history: [] as HistoryEntry[],
  escalation: null as Escalation | null,
};

/**
 * Any change to the answers makes a SAFE result stale: the gate has to run again before the flow can go on. Only SAFE is
 * dropped. A RED_FLAG or CLARIFY result stays until the next run (it never grants anything, and the re-ask screen needs its
 * CLARIFY while the patient answers again).
 */
const staleGate = (s: Pick<SessionState, 'gateOutput' | 'gateVerdict'>) => (s.gateVerdict === 'SAFE' ? { gateOutput: null, gateVerdict: null } : {});

export const useSession = create<SessionState>((set, get) => ({
  ...initial,

  setMode: (mode) => set({ mode }),
  setReaskDone: (reaskDone) => set({ reaskDone }),
  setSelection: (selection) => set({ selection }),

  recordAnswer: (answer) =>
    set((s) => ({
      answers: [...s.answers.filter((a) => a.questionId !== answer.questionId), answer],
      ...staleGate(s),
    })),

  runGate: () => {
    // The gate sees the answers plus the structured onset and unable-to-move inputs derived from them (flow/gateInputs.ts).
    const { answers, movementResults } = get();
    const output = evaluateStub([...answers, ...structuredGateInputs(answers, movementResults)]);
    set({ gateOutput: output, gateVerdict: output.verdict });
    return output.verdict;
  },

  recordMovement: (result) =>
    set((s) => ({
      movementResults: [
        ...s.movementResults.filter((m) => m.movementId !== result.movementId),
        result,
      ],
      ...staleGate(s),
    })),

  recordNarrowing: (snapshot) => set((s) => ({ liveState: snapshot.state, narrowingTrail: [...s.narrowingTrail, snapshot] })),

  logAnswer: (entry) => {
    const now = new Date().toISOString();
    const seq = get().history.length + 1;
    const made: HistoryEntry = { seq, at: now, ...entry };
    set((s) => ({
      history: [...s.history.map((h) => (h.id === entry.id && !h.supersededAt ? { ...h, supersededAt: now } : h)), made],
      narrowingTrail: s.narrowingTrail.map((t) => (t.afterId === entry.id && !t.supersededAt && t.seq !== undefined && t.seq !== seq ? { ...t, supersededAt: now } : t)),
    }));
    return made;
  },

  supersedeLast: () => {
    const active = get().history.filter((h) => !h.supersededAt);
    const last = active[active.length - 1];
    if (!last) return null;
    const now = new Date().toISOString();
    set((s) => ({
      history: s.history.map((h) => (h.seq === last.seq ? { ...h, supersededAt: now } : h)),
      narrowingTrail: s.narrowingTrail.map((t) => (t.seq === last.seq && !t.supersededAt ? { ...t, supersededAt: now } : t)),
    }));
    return { ...last, supersededAt: now };
  },

  rebuildFromHistory: () =>
    set((s) => {
      const active = s.history.filter((h) => !h.supersededAt);
      const isLive = (id: string) => isDiscriminator(id) || isStructureQuestion(id);
      return {
        answers: [...s.answers.filter((a) => !isLive(a.questionId)), ...active.filter((h) => h.kind === 'question' && h.answer).map((h) => h.answer as Answer)],
        movementResults: active.filter((h) => h.kind === 'movement' && h.movement).map((h) => h.movement as MovementResult),
        ...staleGate(s),
      };
    }),

  setEscalation: (escalation) => set((s) => (s.escalation ? {} : { escalation })),

  reset: () => set({ ...initial }),
}));

/** Input for the narrowing step, or null until the patient has chosen a spot. */
export function narrowingInputFrom(
  s: Pick<SessionState, 'selection' | 'answers' | 'movementResults'>,
): NarrowingInput | null {
  if (!s.selection) return null;
  return {
    layer: s.selection.layer,
    regionId: s.selection.regionId,
    subRegionId: s.selection.subRegionId,
    point: s.selection.point,
    hitMeshName: s.selection.hitStructure?.meshName ?? null,
    depthAnswer: depthAnswerFrom(s.answers),
    movementResults: s.movementResults,
    answers: s.answers,
  };
}
