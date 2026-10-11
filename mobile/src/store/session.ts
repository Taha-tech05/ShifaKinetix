import { create } from 'zustand';
import type { Answer, Verdict } from '../gate/evaluate';
import { evaluateStub } from '../gate/stub';
import { structuredGateInputs } from '../flow/gateInputs';
import type { LiveState, NarrowingSnapshot } from '../narrowing/live';
import { depthAnswerFrom } from '../dev/followUpQuestions';
import type { NarrowingInput } from '../dev/narrowingStub';
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

export interface SessionState {
  /** What the patient tapped on the body: side, sub-region, point, closest structure and layer. */
  /** "exact" when the patient can point to the spot, "region" for the whole area (also when not sure). */
  mode: IntakeMode | null;
  selection: BodySelection | null;
  answers: Answer[];
  gateVerdict: Verdict | null;
  /** True once the clarifying re-ask has been used (it is offered only once). */
  reaskDone: boolean;
  movementResults: MovementResult[];
  /** What the live strip last showed. The result screen shows exactly this (it does not compute again). */
  liveState: LiveState | null;
  /** One snapshot per answer, in order, so a doctor view can later show how the ranking evolved. */
  narrowingTrail: NarrowingSnapshot[];

  setMode: (mode: IntakeMode | null) => void;
  setReaskDone: (done: boolean) => void;
  setSelection: (selection: BodySelection | null) => void;
  /** Adds an answer, replacing any earlier answer to the same question. */
  recordAnswer: (answer: Answer) => void;
  runGate: () => Verdict;
  recordMovement: (result: MovementResult) => void;
  /** Stores the live state and appends the snapshot of this step. */
  recordNarrowing: (snapshot: NarrowingSnapshot) => void;
  reset: () => void;
}

const initial = {
  mode: null,
  selection: null,
  answers: [] as Answer[],
  gateVerdict: null,
  reaskDone: false,
  movementResults: [] as MovementResult[],
  liveState: null as LiveState | null,
  narrowingTrail: [] as NarrowingSnapshot[],
};

export const useSession = create<SessionState>((set, get) => ({
  ...initial,

  setMode: (mode) => set({ mode }),
  setReaskDone: (reaskDone) => set({ reaskDone }),
  setSelection: (selection) => set({ selection }),

  recordAnswer: (answer) =>
    set((s) => ({
      answers: [...s.answers.filter((a) => a.questionId !== answer.questionId), answer],
    })),

  runGate: () => {
    // The gate sees the answers plus the structured onset and unable-to-move inputs derived from them (flow/gateInputs.ts).
    const { answers, movementResults } = get();
    const { verdict } = evaluateStub([...answers, ...structuredGateInputs(answers, movementResults)]);
    set({ gateVerdict: verdict });
    return verdict;
  },

  recordMovement: (result) =>
    set((s) => ({
      movementResults: [
        ...s.movementResults.filter((m) => m.movementId !== result.movementId),
        result,
      ],
    })),

  recordNarrowing: (snapshot) => set((s) => ({ liveState: snapshot.state, narrowingTrail: [...s.narrowingTrail, snapshot] })),

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
