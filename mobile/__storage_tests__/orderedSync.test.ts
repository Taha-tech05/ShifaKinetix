import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './sqlite';
import { OrderedSyncEvent } from '../src/storage/intakeStore';
import { SavedContext } from '../src/storage/syncContext';
import { SafetyAnswer } from '../src/gate/evaluate';

const answer: SafetyAnswer = { questionId: 'unable', type: 'yesno', value: false, state: 'answered' };
const context: SavedContext = { mode: 'region', reaskDone: false, movementResults: [],
  selection: { regionId: 'shoulder_right', subRegionId: 'front', point: { x: 0, y: 1, z: 0 }, layer: 'muscle', hitStructure: null },
  answers: [answer, { questionId: 'Q_SAFETY_REVIEW_unable', type: 'safety-review', value: 'local-token', state: 'answered' },
    { questionId: 'Q_BASICS_HOW', type: 'chooseone', value: 'after_injury', state: 'answered' }] };
let directory: string;
let opened: ReturnType<typeof openDatabase>;
beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'shifa-order-'));
  opened = openDatabase(join(directory, 'test.db'));
  await opened.store.initialize(); await opened.store.createIntake('new');
});
afterEach(() => { opened.db.close(); rmSync(directory, { recursive: true, force: true }); });

test('restart preserves evidence before follow-ups, excludes local clearance, and retains immutable history after upload', async () => {
  await opened.store.saveAnswer('new', answer);
  await opened.store.saveAnswer('new', answer, context);
  opened.db.close(); opened = openDatabase(join(directory, 'test.db')); await opened.store.initialize();
  const sent: OrderedSyncEvent[] = [];
  expect(await opened.store.syncOrdered('new', 'account', async (e) => { sent.push(e); })).toEqual({ sent: 3, remaining: 0 });
  expect(sent.map((e) => e.kind)).toEqual(['answer', 'context', 'answer']);
  expect(sent[1].kind === 'context' && sent[1].context.appAnswers.map((a) => a.questionId)).toEqual(['Q_BASICS_HOW']);
  expect(await opened.store.history('new')).toHaveLength(3);
  expect(() => opened.db.exec('DELETE FROM intake_event_history')).toThrow('append-only');
  expect(() => opened.db.exec("UPDATE intake_event_history SET payload = '{}' ")).toThrow('append-only');
});

test('lost response retries exactly the same event and blocks account/server switches', async () => {
  await opened.store.saveAnswer('new', answer, context);
  const events: OrderedSyncEvent[] = [];
  await expect(opened.store.syncOrdered('new', 'server/account', async (e) => { events.push(e); throw Error('lost response'); })).rejects.toThrow('lost response');
  expect(await opened.store.pending('new')).toHaveLength(2);
  const wrong = jest.fn();
  await expect(opened.store.syncOrdered('new', 'other/account', wrong)).rejects.toThrow('different account');
  expect(wrong).not.toHaveBeenCalled();
  await opened.store.syncOrdered('new', 'server/account', async (e) => { events.push(e); });
  expect(events[0]).toEqual(events[1]);
  expect(await opened.store.pending('new')).toHaveLength(0);
});

test('history failure rolls back context, answer and outbox together', async () => {
  opened.db.exec("CREATE TRIGGER fail_history BEFORE INSERT ON intake_event_history BEGIN SELECT RAISE(ABORT, 'disk full'); END;");
  await expect(opened.store.saveAnswer('new', answer, context)).rejects.toThrow('disk full');
  expect(await opened.store.answers('new')).toEqual([]);
  expect(await opened.store.pending('new')).toEqual([]);
  await expect(opened.store.context('new')).rejects.toThrow('No resumable');
});

test('legacy queues are retained without inventing chronology and do not block new assessments', async () => {
  await opened.store.createIntake('legacy'); await opened.store.saveAnswer('legacy', answer);
  opened.db.exec("DELETE FROM intake_sync_state WHERE intake_id = 'legacy'");
  const send = jest.fn();
  await expect(opened.store.syncOrdered('legacy', 'account', send)).rejects.toThrow('no ordered upload history');
  expect(send).not.toHaveBeenCalled();
  await opened.store.saveAnswer('new', answer, context);
  await opened.store.syncOrdered('new', 'account', send);
  expect(await opened.store.pending('legacy')).toHaveLength(1);
  expect(await opened.store.pending('new')).toHaveLength(0);
});

test('concurrent sync is refused and evidence saved during upload waits for the next run', async () => {
  await opened.store.saveAnswer('new', answer);
  const result = await opened.store.syncOrdered('new', 'account', async () => {
    await expect(opened.store.syncOrdered('new', 'account', jest.fn())).rejects.toThrow('already running');
    await opened.store.saveAnswer('new', { ...answer, value: true }, context);
  });
  expect(result).toEqual({ sent: 1, remaining: 2 });
  expect(await opened.store.history('new')).toHaveLength(3);
});
