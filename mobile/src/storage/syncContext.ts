import type { GateOutput } from '../gate/evaluate';
import { questions } from '../gate/evaluate';
import type { SessionState } from '../store/session';

export type SavedContext = Pick<SessionState, 'mode' | 'selection' | 'answers' | 'movementResults' | 'reaskDone'>
  & Partial<Pick<SessionState, 'history' | 'narrowingTrail'>>;
const canonical = new Set(questions.map((q) => q.questionId));

/** Raw evidence only: local review tokens never authorize a server follow-up. */
export function uploadContext(saved: SavedContext, clientGate?: GateOutput) {
  if (!saved.selection || !Array.isArray(saved.answers) || !Array.isArray(saved.movementResults)) {
    throw new Error('Invalid context; upload was not queued.');
  }
  return {
    regionId: `${saved.selection.regionId}_${saved.selection.subRegionId}`,
    mode: saved.mode,
    selection: saved.selection,
    appAnswers: saved.answers.filter((a) => !canonical.has(a.questionId) && !a.questionId.startsWith('Q_SAFETY_')),
    movements: saved.movementResults,
    history: saved.history ?? [],
    narrowingTrail: saved.narrowingTrail ?? [],
    ...(clientGate ? { clientGate } : {}),
  };
}
export type UploadContext = ReturnType<typeof uploadContext>;
