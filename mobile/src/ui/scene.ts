// UI-only state of the symptom screen (the 3D scene with the chat sheet). Nothing here is clinical: it carries what a route
// wants shown in the shared sheet and stage, so the 3D body and the sheet can stay mounted while the route changes.
import { createContext } from 'react';
import { create } from 'zustand';
import type { CameraPreset } from '../components/body3d/cameraRig';
import type { Movement } from '../movement/movements';
import type { Side } from '../movement/rig';

/** What a route hands to the shared sheet. */
export interface SheetContent {
  /** Changes when the question changes: the sheet shows the typing dots, then the new content. */
  contentKey: string;
  /** Question ids this route draws itself, so the history above does not repeat them. */
  ownIds: string[];
  node: React.ReactNode;
}

/** Props the movement route gives the shared movement stage. */
export interface StageProps {
  movement: Movement;
  side: Side;
  paused: boolean;
  highlightIds: string[];
  autoFocus: boolean;
  /** Result screen: labels with leader lines, the "approximate area" note and the upper-body camera. */
  labelIds?: string[];
  approx?: boolean;
  cameraPreset?: CameraPreset;
}

/**
 * How the sheet should behave for the current step:
 *  - questions: half height
 *  - moving: collapsed to peek while the movement animation plays
 *  - feel: half height, answers shown (after the animation played once)
 *  - redflag: half height, calm red "see a doctor" state
 *  - caution: the same takeover without the red accent (the answers stayed unclear)
 */
export type SceneMode = 'questions' | 'moving' | 'feel' | 'redflag' | 'caution';

interface SceneState {
  sheet: SheetContent | null;
  onBack: (() => void) | null;
  progress: { label: string; value: number } | null;
  mode: SceneMode;
  stepKey: string;
  /** Short movement instruction for the chip over the stage. */
  instruction: string | null;
  stage: StageProps | null;
  /** Increases each time the movement animation has played through once. */
  playedNonce: number;
  demoDismissed: boolean;
  setSheet: (s: SheetContent | null) => void;
  setOnBack: (f: (() => void) | null) => void;
  setProgress: (p: SceneState['progress']) => void;
  setStep: (p: { mode: SceneMode; stepKey: string; instruction: string | null }) => void;
  setStage: (s: StageProps | null) => void;
  markPlayed: () => void;
  dismissDemo: () => void;
}

export const useScene = create<SceneState>((set) => ({
  sheet: null,
  onBack: null,
  progress: null,
  mode: 'questions',
  stepKey: '',
  instruction: null,
  stage: null,
  playedNonce: 0,
  demoDismissed: false,
  setSheet: (sheet) => set({ sheet }),
  setOnBack: (onBack) => set({ onBack }),
  setProgress: (progress) => set({ progress }),
  setStep: ({ mode, stepKey, instruction }) => set({ mode, stepKey, instruction }),
  setStage: (stage) => set({ stage }),
  markPlayed: () => set((s) => ({ playedNonce: s.playedNonce + 1 })),
  dismissDemo: () => set({ demoDismissed: true }),
}));

/** True inside report/_layout: the shared sheet is there to receive content. Without it (tests, other screens) content renders in place. */
export const SceneHostContext = createContext(false);
