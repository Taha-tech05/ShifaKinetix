import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IntakeStore, SqlDatabase, SyncEvent } from '../src/storage/intakeStore';
import { SafetyAnswer as Answer, questions } from '../src/gate/evaluate';
import { SafetySession } from '../src/gate/safetySession';
import { useSession } from '../src/store/session';
import { lowRiskAnswers } from '../__tests__/support/safetyAnswers';

// A real SQLite engine; Node 22 test job only. The phone uses expo-sqlite.
const { DatabaseSync } = createRequire(__filename)('node:sqlite') as typeof import('node:sqlite');
let directory: string;
let db: InstanceType<typeof DatabaseSync>;
let store: IntakeStore;
let adapter: SqlDatabase;
const no: Answer = { questionId: 'unable', type: 'yesno', state: 'answered', value: false };
const gradual: Answer = { questionId: 'onset', type: 'choice', state: 'answered', value: 'gradual' };
function open() {
  db = new DatabaseSync(join(directory, 'intake.db'));
  adapter = {
    execAsync: async (sql) => { db.exec(sql); },
    runAsync: async (sql, ...params) => db.prepare(sql).run(...params),
    getAllAsync: async <T>(sql: string, ...params: (string | number | null)[]) => db.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T>(sql: string, ...params: (string | number | null)[]) => (db.prepare(sql).get(...params) as T) ?? null,
    withExclusiveTransactionAsync: async (task) => {
      db.exec('BEGIN IMMEDIATE');
      try { await task(adapter); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
  store = new IntakeStore(adapter);
}
beforeEach(async () => {
  useSession.getState().reset();
  directory = mkdtempSync(join(tmpdir(), 'shifakinetix-test-'));
  open();
  await store.initialize();
  await store.createIntake('test-intake');
});

function selectedSession() {
  useSession.getState().setMode('region');
  useSession.getState().setSelection({ regionId: 'shoulder_right', subRegionId: 'front',
    point: { x: 0, y: 1, z: 0 }, layer: 'muscle', hitStructure: null });
  return new SafetySession(store);
}

test('integrated intake resumes from SQLite after restart and retains repeated uncertainty', async () => {
  const session = selectedSession();
  await session.start('integrated');
  await session.save({ ...no, state: 'unknown', value: null });
  await session.save({ ...no, state: 'unknown', value: null, clarificationAttempted: true });
  useSession.getState().reset(); db.close(); open(); await store.initialize();
  const resumed = new SafetySession(store);
  expect((await resumed.resumeLatest()).verdict).toBe('CLARIFY');
  expect(useSession.getState().selection?.regionId).toBe('shoulder_right');
  expect(useSession.getState().answers[0].clarificationAttempted).toBe(true);
});

test('conditional infection uncertainty survives restart and requires an explicit resolution', async () => {
  const session = selectedSession(); await session.start('conditional');
  for (const a of lowRiskAnswers()) await session.save(a);
  expect((await session.checkpoint()).verdict).toBe('SAFE');
  await session.save({ questionId: 'redness', type: 'yesno', state: 'answered', value: true });
  expect((await session.checkpoint()).firedRules.map((r) => r.ruleId)).toEqual(['P_redness', 'M_infection_risk']);
  await session.save({ questionId: 'infection_risk', type: 'yesno', state: 'unknown', value: null, clarificationAttempted: true });
  session.dispose(); useSession.getState().reset(); db.close(); open(); await store.initialize();
  const resumed = new SafetySession(store);
  // still not sure after the simpler question: one unresolved answer gives Soon (doctor in a few days, no movements)
  expect(await resumed.resumeLatest()).toMatchObject({ verdict: 'SAFE', level: 'SOON' });
  expect((await resumed.checkpoint()).firedRules.map((r) => r.ruleId)).toEqual(['P_redness', 'N_infection_risk']);
  await resumed.save({ questionId: 'infection_risk', type: 'yesno', state: 'answered', value: false, clarificationAttempted: true });
  expect(await resumed.checkpoint()).toMatchObject({ verdict: 'SAFE', level: 'ROUTINE' });
  resumed.dispose();
});

test('integrated SAFE requires saved answers and reset cannot reuse the prior intake', async () => {
  const session = selectedSession(); await session.start('integrated');
  for (const a of lowRiskAnswers()) await session.save(a);
  expect((await session.checkpoint()).verdict).toBe('SAFE');
  useSession.getState().recordAnswer({ ...no, value: true });
  await expect(session.checkpoint()).rejects.toThrow('do not match');
  expect(useSession.getState().gateVerdict).toBeNull();
  useSession.getState().reset();
  expect(session.activeId).toBeNull();
  await expect(session.checkpoint()).rejects.toThrow('Start or explicitly resume');
});

test('focused follow-ups survive SQLite restart but changed evidence invalidates them', async () => {
  const session = selectedSession();
  useSession.getState().recordAnswer({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value: 'after_injury', state: 'answered' });
  await session.start('followup');
  for (const a of lowRiskAnswers()) await session.save(a);
  expect((await session.checkpoint()).verdict).toBe('SAFE');
  session.dispose(); useSession.getState().reset(); db.close(); open(); await store.initialize();
  const resumed = new SafetySession(store);
  expect((await resumed.resumeLatest()).verdict).toBe('SAFE');
  expect(useSession.getState().answers.some((a) => a.questionId === 'Q_SAFETY_REVIEW_onset')).toBe(true);
  // Changing away and back must not revive the earlier confirmation.
  useSession.getState().recordAnswer({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value: 'slowly', state: 'answered' });
  useSession.getState().recordAnswer({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value: 'after_injury', state: 'answered' });
  expect((await resumed.checkpoint()).verdict).toBe('CLARIFY');
  resumed.dispose();
});

test('failed context write cannot persist a follow-up clearance on restart', async () => {
  const session = selectedSession();
  useSession.getState().recordAnswer({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value: 'after_injury', state: 'answered' });
  await session.start('failed-followup');
  for (const a of lowRiskAnswers({}, ['onset'])) await session.save(a);
  jest.spyOn(store, 'saveContext').mockRejectedValueOnce(new Error('disk full'));
  await expect(session.save(gradual)).rejects.toThrow('disk full');
  expect(useSession.getState().gateVerdict).toBeNull();
  session.dispose(); useSession.getState().reset(); db.close(); open(); await store.initialize();
  const resumed = new SafetySession(store);
  expect((await resumed.resumeLatest()).verdict).toBe('CLARIFY');
  resumed.dispose();
});

test('context write failure cannot grant clearance', async () => {
  const session = selectedSession(); await session.start('integrated');
  db.exec("CREATE TRIGGER fail_context BEFORE INSERT ON intake_context BEGIN SELECT RAISE(ABORT, 'disk full'); END;");
  await expect(session.save(no)).rejects.toThrow('disk full');
  expect(useSession.getState().gateVerdict).toBeNull();
  // Context/evidence and its reviewing answer now roll back atomically.
  expect(await store.answers('integrated')).toHaveLength(0);
});
afterEach(() => { db.close(); rmSync(directory, { recursive: true, force: true }); });

test('typed unknowns and pending uploads survive a database close and reopen', async () => {
  await store.saveAnswer('test-intake', { ...no, state: 'unknown', value: null, clarificationAttempted: true });
  db.close(); open(); await store.initialize();
  expect(await store.latestIntake()).toBe('test-intake');
  expect((await store.answers('test-intake'))[0]).toMatchObject({ value: null, state: 'unknown', clarificationAttempted: true });
  expect((await store.savedGate('test-intake')).verdict).toBe('CLARIFY');
  expect(await store.pending()).toHaveLength(1);
});

test('offline complete negatives clear; danger persisted later overrides clearance', async () => {
  for (const a of lowRiskAnswers()) await store.saveAnswer('test-intake', a);
  expect((await store.savedGate('test-intake')).verdict).toBe('SAFE');
  await store.saveAnswer('test-intake', { ...no, value: true });
  expect((await store.savedGate('test-intake')).verdict).toBe('RED_FLAG');
  await store.createIntake('fresh');
  expect((await store.savedGate('fresh')).verdict).toBe('CLARIFY');
});

test('answer and outbox write roll back together when enqueue fails', async () => {
  db.exec("CREATE TRIGGER fail_queue BEFORE INSERT ON intake_outbox BEGIN SELECT RAISE(ABORT, 'disk failure'); END;");
  await expect(store.saveAnswer('test-intake', no)).rejects.toThrow('disk failure');
  expect(await store.answers('test-intake')).toEqual([]);
});

test('retry preserves order and stable keys, deleting only acknowledged events', async () => {
  await store.saveAnswer('test-intake', no);
  await store.saveAnswer('test-intake', { ...no, value: true });
  const attempts: SyncEvent[] = [];
  await expect(store.sync(async (event) => { attempts.push(event); throw new Error('offline'); })).rejects.toThrow('offline');
  expect(await store.pending()).toHaveLength(2);
  await store.sync(async (event) => { attempts.push(event); });
  expect(attempts[0].idempotencyKey).toBe(attempts[1].idempotencyKey);
  expect(attempts.map((e) => e.answer.value)).toEqual([false, false, true]);
  expect(await store.pending()).toEqual([]);
});

test('invalid answers and stale intakes cannot be persisted', async () => {
  await expect(store.saveAnswer('test-intake', { ...no, value: 'false' })).rejects.toThrow();
  await expect(store.saveAnswer('unknown-intake', no)).rejects.toThrow();
  db.exec("UPDATE intake_sessions SET content_version = 'old'");
  await expect(store.savedGate('test-intake')).rejects.toThrow();
  expect(await store.pending()).toEqual([]);
});

test('tampered cache blocks evaluation and bundled content restores it on restart', async () => {
  db.exec("UPDATE intake_content SET rules_json = '{}'");
  await expect(store.savedGate('test-intake')).rejects.toThrow('Safety content');
  await store.initialize();
  expect(await store.cachedQuestions()).toHaveLength(questions.length);
});

test('older content cannot resume or sync silently and its queued answers are preserved', async () => {
  await store.saveAnswer('test-intake', no);
  const pending = await store.pending();
  const payload = JSON.parse(pending[0].payload);
  payload.contentVersion = 'shoulder-1';
  db.prepare('UPDATE intake_outbox SET payload = ?').run(JSON.stringify(payload));
  db.exec("UPDATE intake_sessions SET content_version = 'shoulder-1'");
  db.close(); open(); await store.initialize();
  await expect(store.savedGate('test-intake')).rejects.toThrow('new intake');
  const send = jest.fn();
  await expect(store.sync(send)).rejects.toThrow('Sync stopped');
  expect(send).not.toHaveBeenCalled();
  expect(await store.pending()).toHaveLength(1);
});

test('corrupt saved values cannot silently become SAFE', async () => {
  await store.saveAnswer('test-intake', no);
  db.exec("UPDATE intake_answers SET value_json = '\"false\"'");
  await expect(store.savedGate('test-intake')).rejects.toThrow('invalid');
});

test('queue records added during sending remain for a later sync', async () => {
  await store.saveAnswer('test-intake', no);
  await store.sync(async () => { await store.saveAnswer('test-intake', { ...no, value: true }); });
  expect(await store.pending()).toHaveLength(1);
});
