import { create } from 'zustand';
import type { Answer, Verdict } from '../gate/evaluate';
import { evaluateStub } from '../gate/stub';

export type Depth = 'surface' | 'middle' | 'deep';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

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
  regionId: string | null;
  point: Point3D | null;
  depth: Depth | null;
  answers: Answer[];
  gateVerdict: Verdict | null;
  movementResults: MovementResult[];

  setRegion: (regionId: string | null, point?: Point3D | null) => void;
  setDepth: (depth: Depth | null) => void;
  /** Adds an answer, replacing any earlier answer to the same question. */
  recordAnswer: (answer: Answer) => void;
  runGate: () => Verdict;
  recordMovement: (result: MovementResult) => void;
  reset: () => void;
}

const initial = {
  regionId: null,
  point: null,
  depth: null,
  answers: [] as Answer[],
  gateVerdict: null,
  movementResults: [] as MovementResult[],
};

export const useSession = create<SessionState>((set, get) => ({
  ...initial,

  setRegion: (regionId, point = null) => set({ regionId, point }),
  setDepth: (depth) => set({ depth }),

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
