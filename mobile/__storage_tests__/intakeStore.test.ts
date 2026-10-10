import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IntakeStore, SqlDatabase, SyncEvent } from '../src/storage/intakeStore';
import { Answer, questions } from '../src/gate/evaluate';

// A real SQLite engine; Node 22 test job only. The phone uses expo-sqlite.
const { DatabaseSync } = createRequire(__filename)('node:sqlite') as typeof import('node:sqlite');
let directory: string;
let db: InstanceType<typeof DatabaseSync>;
let store: IntakeStore;
let adapter: SqlDatabase;
const no: Answer = { questionId: 'injury', type: 'yesno', state: 'answered', value: false };
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
  directory = mkdtempSync(join(tmpdir(), 'shifakinetix-test-'));
  open();
  await store.initialize();
  await store.createIntake('test-intake');
});
afterEach(() => { db.close(); rmSync(directory, { recursive: true, force: true }); });

test('typed unknowns and pending uploads survive a database close and reopen', async () => {
  await store.saveAnswer('test-intake', { ...no, state: 'unknown', value: null, clarificationAttempted: true });
  db.close(); open(); await store.initialize();
  expect(await store.latestIntake()).toBe('test-intake');
  expect((await store.answers('test-intake'))[0]).toMatchObject({ value: null, state: 'unknown', clarificationAttempted: true });
  expect((await store.savedGate('test-intake')).verdict).toBe('RED_FLAG');
  expect(await store.pending()).toHaveLength(1);
});

test('offline complete negatives clear; danger persisted later overrides clearance', async () => {
  for (const q of questions.filter((q) => q.required)) {
    await store.saveAnswer('test-intake', { questionId: q.questionId, type: q.type as Answer['type'],
      state: 'answered', value: q.type === 'choice' ? 'normal' : false });
  }
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
  expect(await store.cachedQuestions()).toHaveLength(20);
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
