import { create } from 'zustand';
import type { Answer, Verdict } from '../gate/evaluate';
import { evaluateStub } from '../gate/stub';
import type { NarrowingInput } from '../narrowing/stub';
import { depthAnswerFrom } from '../questions/followUp';
import type { BodySelection, Point3D } from '../regions/types';

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
  selection: BodySelection | null;
  answers: Answer[];
  gateVerdict: Verdict | null;
  movementResults: MovementResult[];

  setSelection: (selection: BodySelection | null) => void;
  /** Adds an answer, replacing any earlier answer to the same question. */
  recordAnswer: (answer: Answer) => void;
  runGate: () => Verdict;
  recordMovement: (result: MovementResult) => void;
  reset: () => void;
}

const initial = {
  selection: null,
  answers: [] as Answer[],
  gateVerdict: null,
  movementResults: [] as MovementResult[],
};

export const useSession = create<SessionState>((set, get) => ({
  ...initial,

  setSelection: (selection) => set({ selection }),

  recordAnswer: (answer) =>
    set((s) => ({
      answers: [...s.answers.filter((a) => a.questionId !== answer.questionId), answer],
    })),

  runGate: () => {
    const { verdict } = evaluateStub(get().answers);
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

  reset: () => set({ ...initial }),
}));

/** Input for the narrowing step, or null until the patient has chosen a spot. */
export function narrowingInputFrom(
  s: Pick<SessionState, 'selection' | 'answers' | 'movementResults'>,
): NarrowingInput | null {
  if (!s.selection) return null;
  return {
    layer: s.selection.layer,
    subRegionId: s.selection.subRegionId,
    point: s.selection.point,
    depthAnswer: depthAnswerFrom(s.answers),
    movementResults: s.movementResults,
  };
}
