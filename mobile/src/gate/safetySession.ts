import { isValidAnswer, questions, SafetyAnswer } from './evaluate';
import { useSession } from '../store/session';
import type { SessionState } from '../store/session';
import type { IntakeStore } from '../storage/intakeStore';
import { structuredGateInputs } from '../flow/gateInputs';
import { withMovementUncertainty } from './sessionEvaluator';
import { evaluateSessionGate, REVIEW_PREFIX, safetyReviewToken } from './sessionAdapter';

const ids = new Set(questions.map((q) => q.questionId));
type Context = Pick<SessionState, 'mode' | 'selection' | 'answers' | 'movementResults' | 'reaskDone'>
  & Partial<Pick<SessionState, 'history' | 'narrowingTrail'>>;
export const safetySnapshot = (s: Context): Context => ({ mode: s.mode, selection: s.selection,
  answers: s.answers, movementResults: s.movementResults, reaskDone: s.reaskDone,
  history: s.history ?? [], narrowingTrail: s.narrowingTrail ?? [] });
export const safetyFingerprint = (s: Context) => JSON.stringify(safetySnapshot(s));
const reviewInput = (s: Context) => withMovementUncertainty([
  ...s.answers, ...structuredGateInputs(s.answers, s.movementResults),
], s.movementResults);

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
    || (s.history !== undefined && !Array.isArray(s.history))
    || (s.narrowingTrail !== undefined && !Array.isArray(s.narrowingTrail))
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
      // Once evidence changes, discard its old acknowledgment; toggling back to
      // the previous value must not resurrect clearance from an earlier review.
      const answers = next.answers.filter((a) => !a.questionId.startsWith(REVIEW_PREFIX)
        || !previous.answers.some((p) => p.questionId === a.questionId && p.value === a.value)
        || safetyReviewToken(reviewInput(next), a.questionId.slice(REVIEW_PREFIX.length))
          === safetyReviewToken(reviewInput(previous), a.questionId.slice(REVIEW_PREFIX.length)));
      if (answers.length !== next.answers.length) useSession.setState({ answers });
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
    useSession.setState({ answers: s.answers.filter((a) => !ids.has(a.questionId) && !a.questionId.startsWith(REVIEW_PREFIX)),
      movementResults: [], history: [], narrowingTrail: [], liveState: null,
      reaskDone: false, gateOutput: null, gateVerdict: null });
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
  save(answer: SafetyAnswer) {
    return this.serialize(() => this.saveAndConfirm(answer));
  }
  private async saveAndConfirm(answer: SafetyAnswer) {
    const id = this.activeId;
    if (!id || !isValidAnswer(answer)) throw new Error('Start or resume a safety intake first.');
    const previous = useSession.getState().answers.find((a) => a.questionId === answer.questionId);
    const next = { ...answer, clarificationAttempted: answer.clarificationAttempted || previous?.clarificationAttempted || false };
    const before = safetySnapshot(useSession.getState());
    const fingerprint = safetyFingerprint(before);
    try { await this.store.saveAnswer(id, next, before); }
    catch (error) { useSession.setState({ gateOutput: null, gateVerdict: null }); throw error; }
    if (this.activeId !== id || safetyFingerprint(useSession.getState()) !== fingerprint) {
      useSession.setState({ gateOutput: null, gateVerdict: null });
      throw new Error('The intake changed while saving. Please retry.');
    }
    useSession.getState().recordAnswer(next);
    const state = useSession.getState();
    const token = safetyReviewToken(reviewInput(state), answer.questionId);
    if (token !== null) state.recordAnswer({ questionId: REVIEW_PREFIX + answer.questionId,
      type: 'safety-review', state: 'answered', value: token });
    return this.confirm();
  }
  checkpoint() {
    return this.serialize(() => this.confirm());
  }
  private serialize<T>(work: () => Promise<T>) {
    const pending = this.writes.then(work);
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
      await this.store.saveContext(id, safetySnapshot(s), evaluateSessionGate(reviewInput(s)));
      if (this.activeId !== id || safetyFingerprint(useSession.getState()) !== fingerprint) throw new Error('Answers changed. Please retry.');
      useSession.getState().runGate();
      if (useSession.getState().gateVerdict === 'SAFE' && useSession.getState().escalation?.verdict === 'CLARIFY') {
        useSession.setState({ escalation: null });
      }
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
