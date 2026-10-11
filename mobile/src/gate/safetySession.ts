import { isValidAnswer, questions, SafetyAnswer } from './evaluate';
import { useSession } from '../store/session';
import type { SessionState } from '../store/session';
import type { IntakeStore } from '../storage/intakeStore';

const ids = new Set(questions.map((q) => q.questionId));
type Context = Pick<SessionState, 'mode' | 'selection' | 'answers' | 'movementResults' | 'reaskDone'>;
export const safetySnapshot = (s: Context): Context => ({ mode: s.mode, selection: s.selection,
  answers: s.answers, movementResults: s.movementResults, reaskDone: s.reaskDone });
export const safetyFingerprint = (s: Context) => JSON.stringify(safetySnapshot(s));

function readContext(value: unknown): Context {
  if (!value || typeof value !== 'object') throw new Error('Invalid saved intake.');
  const s = value as Context;
  if (!['exact', 'region'].includes(s.mode ?? '') || !s.selection
    || !['shoulder_left', 'shoulder_right'].includes(s.selection.regionId)
    || !['front', 'back', 'top', 'side', 'scapular'].includes(s.selection.subRegionId)
    || !['bone', 'muscle'].includes(s.selection.layer)
    || !s.selection.point || ![s.selection.point.x, s.selection.point.y, s.selection.point.z].every(Number.isFinite)
    || (s.selection.hitStructure !== null && (!s.selection.hitStructure
      || typeof s.selection.hitStructure.meshName !== 'string' || typeof s.selection.hitStructure.name !== 'string'
      || !['bone', 'muscle'].includes(s.selection.hitStructure.kind)))
    || typeof s.reaskDone !== 'boolean'
    || !Array.isArray(s.answers) || !Array.isArray(s.movementResults)
    || !s.answers.every((a) => a && typeof a.questionId === 'string' && typeof a.type === 'string'
      && (a.state === 'answered' || (a.state === 'unknown' && a.value === null)))
    || !s.movementResults.every((m) => m && typeof m.movementId === 'string'
      && typeof m.state === 'string' && ['painful', 'weak', 'unableToDo'].every((k) => typeof m[k as keyof typeof m] === 'boolean'))) {
    throw new Error('Invalid saved intake. Start a new assessment.');
  }
  return s;
}

/** Coordinates durable safety answers with B's synchronous session store. Never persists a trusted verdict. */
export class SafetySession {
  private active: { id: string; selection: SessionState['selection'] } | null = null;
  private writes: Promise<unknown> = Promise.resolve();
  private readonly unsubscribe: () => void;
  constructor(private readonly store: IntakeStore) {
    this.unsubscribe = useSession.subscribe((next, previous) => {
      if (next.selection !== previous.selection || next.selection === null) this.active = null;
    });
  }
  dispose() { this.unsubscribe(); this.active = null; }
  get activeId() {
    return this.active && this.active.selection === useSession.getState().selection ? this.active.id : null;
  }
  async start(id: string) {
    const s = useSession.getState();
    readContext(safetySnapshot(s));
    await this.store.createIntake(id);
    // New intake explicitly discards prior clinical clearance.
    useSession.setState({ answers: s.answers.filter((a) => !ids.has(a.questionId)),
      movementResults: [], reaskDone: false, gateOutput: null, gateVerdict: null });
    this.active = { id, selection: s.selection };
    await this.checkpoint();
  }
  async resumeLatest() {
    const id = await this.store.latestIntake();
    if (!id) throw new Error('There is no saved safety intake.');
    const saved = readContext(await this.store.context(id));
    await this.store.cachedQuestions();
    const answers = await this.store.answers(id);
    const current = useSession.getState();
    if (current.selection && (current.selection.regionId !== saved.selection!.regionId
      || current.selection.subRegionId !== saved.selection!.subRegionId)) {
      throw new Error('The saved intake is for a different shoulder location. Start a new assessment.');
    }
    // Explicit resume restores that assessment, never combines new symptoms with old clearance.
    useSession.getState().reset();
    useSession.setState({ ...saved, answers: [...saved.answers.filter((a) => !ids.has(a.questionId)), ...answers],
      gateOutput: null, gateVerdict: null });
    this.active = { id, selection: saved.selection };
    return this.checkpoint();
  }
  async save(answer: SafetyAnswer) {
    const id = this.activeId;
    if (!id || !isValidAnswer(answer)) throw new Error('Start or resume a safety intake first.');
    const previous = useSession.getState().answers.find((a) => a.questionId === answer.questionId);
    const next = { ...answer, clarificationAttempted: answer.clarificationAttempted || previous?.clarificationAttempted || false };
    await this.store.saveAnswer(id, next);
    if (this.activeId !== id) throw new Error('The intake changed while saving.');
    useSession.getState().recordAnswer(next);
    return this.checkpoint();
  }
  checkpoint() {
    const pending = this.writes.then(() => this.confirm());
    this.writes = pending.catch(() => undefined);
    return pending;
  }
  private async confirm() {
    const id = this.activeId;
    if (!id) throw new Error('Start or explicitly resume your safety assessment first.');
    const s = useSession.getState();
    const fingerprint = safetyFingerprint(s);
    try {
      await this.store.cachedQuestions();
      const stored = await this.store.answers(id);
      const inMemory = s.answers.filter((a) => ids.has(a.questionId));
      // Do not grant SAFE from unsaved, injected or changed clinical answers.
      const stable = (values: typeof inMemory) => JSON.stringify(values.map((a) => ({ questionId: a.questionId,
        type: a.type, state: a.state, value: a.value,
        clarificationAttempted: a.clarificationAttempted === true })).sort((a, b) => a.questionId.localeCompare(b.questionId)));
      if (stable(stored) !== stable(inMemory)) throw new Error('Saved answers do not match this assessment.');
      await this.store.saveContext(id, safetySnapshot(s));
      if (this.activeId !== id || safetyFingerprint(useSession.getState()) !== fingerprint) throw new Error('Answers changed. Please retry.');
      useSession.getState().runGate();
      return useSession.getState().gateOutput!;
    } catch (error) {
      useSession.setState({ gateOutput: null, gateVerdict: null });
      throw error;
    }
  }
}

let instance: Promise<SafetySession> | undefined;
export function openSafetySession(): Promise<SafetySession> {
  if (!instance) instance = import('../storage/nativeStore').then(async ({ openIntakeStore }) =>
    new SafetySession(await openIntakeStore())).catch((error) => { instance = undefined; throw error; });
  return instance;
}
