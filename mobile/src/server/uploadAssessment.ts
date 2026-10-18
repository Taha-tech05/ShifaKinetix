import type { Verdict } from '../gate/evaluate';
import type { ApiClient, ApiIdentity } from '../storage/apiClient';
import type { IntakeStore } from '../storage/intakeStore';

export interface SafetySessionLike { activeId: string | null; checkpoint: () => Promise<unknown> }
export interface UploadDeps {
  openSession: () => Promise<SafetySessionLike>;
  openStore: () => Promise<Pick<IntakeStore, 'latestIntake' | 'pending' | 'syncOrdered'>>;
}

const defaults: UploadDeps = {
  openSession: async () => (await import('../gate/safetySession')).openSafetySession(),
  openStore: async () => (await import('../storage/nativeStore')).openIntakeStore(),
};

/** The assessment on this phone that can be uploaded, and how many saved events are still waiting. */
export async function savedAssessment(deps: UploadDeps = defaults): Promise<{ intakeId: string | null; pending: number }> {
  const session = await deps.openSession();
  const store = await deps.openStore();
  const intakeId = session.activeId ?? await store.latestIntake();
  return { intakeId, pending: intakeId ? (await store.pending(intakeId)).length : 0 };
}

export interface UploadResult { sent: number; remaining: number; serverVerdict: Verdict }

/**
 * Uploads the saved events in order and then asks the server for its own verdict on them. Same steps as the "Saved assessment and
 * sync" form (gate/AssessmentSync.tsx): the server must confirm who this is, every event must be acknowledged, and a failure
 * leaves the data on the phone. `isCurrent` lets the caller stop an upload whose screen is gone.
 */
export async function uploadSavedAssessment(api: ApiClient, expected: ApiIdentity, intakeId: string, isCurrent: () => boolean,
  deps: UploadDeps = defaults): Promise<UploadResult> {
  const user = await api.identity();
  if (user.role !== 'patient' || user.id !== expected.id) throw new Error('Sign in again with the assessment account.');
  const session = await deps.openSession();
  if (session.activeId === intakeId) await session.checkpoint();
  const store = await deps.openStore();
  const result = await store.syncOrdered(intakeId, JSON.stringify([api.baseUrl, user.id]), async (event) => {
    if (!isCurrent()) throw new Error('Upload stopped. Remaining data is retained.');
    await api.send(event);
  });
  const gate = await api.gate(intakeId);
  return { sent: result.sent, remaining: result.remaining, serverVerdict: gate.verdict };
}
