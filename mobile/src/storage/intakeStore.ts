import bank from '../../../shared/questions_shoulder.json';
import rules from '../../../shared/gate_rules.json';
import { SafetyAnswer as Answer, CONTENT_VERSION, evaluate, isValidAnswer, Question, GateOutput } from '../gate/evaluate';
import { SavedContext, uploadContext, UploadContext } from './syncContext';

type Bind = string | number | null;
export interface SqlConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: Bind[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: Bind[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: Bind[]): Promise<T | null>;
}
export interface SqlDatabase extends SqlConnection {
  withExclusiveTransactionAsync(task: (tx: SqlConnection) => Promise<void>): Promise<void>;
}
export interface QueueItem { id: number; intake_id: string; payload: string; attempts: number }
export interface SyncEvent {
  idempotencyKey: string;
  intakeId: string;
  contentVersion: string;
  answer: Answer;
}
export type OrderedSyncEvent = (SyncEvent & { kind: 'answer' }) | {
  kind: 'context'; idempotencyKey: string; intakeId: string; contentVersion: string;
  context: UploadContext & { recordedAt: string };
};

export class IntakeStore {
  private syncing = false;
  constructor(private readonly db: SqlDatabase) {}

  async initialize() {
    await this.db.execAsync(`PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS intake_sessions (
        id TEXT PRIMARY KEY, content_version TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
      CREATE TABLE IF NOT EXISTS intake_answers (
        intake_id TEXT NOT NULL, question_id TEXT NOT NULL, type TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('answered','unknown')),
        value_json TEXT NOT NULL, clarified INTEGER NOT NULL CHECK(clarified IN (0,1)),
        PRIMARY KEY(intake_id, question_id));
      CREATE TABLE IF NOT EXISTS intake_outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT, intake_id TEXT NOT NULL,
        payload TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS intake_content (
        version TEXT PRIMARY KEY, questions_json TEXT NOT NULL, rules_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS intake_context (
        intake_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS intake_sync_state (
        intake_id TEXT PRIMARY KEY, identity TEXT, last_context TEXT);
      CREATE TABLE IF NOT EXISTS intake_event_history (
        id INTEGER PRIMARY KEY, intake_id TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS intake_history_no_update BEFORE UPDATE ON intake_event_history
        BEGIN SELECT RAISE(ABORT, 'intake history is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS intake_history_no_delete BEFORE DELETE ON intake_event_history
        BEGIN SELECT RAISE(ABORT, 'intake history is append-only'); END;`);
    // Bundle is the only trusted content source until signed remote updates exist.
    await this.db.runAsync('INSERT OR REPLACE INTO intake_content VALUES (?, ?, ?)',
      CONTENT_VERSION, JSON.stringify(bank), JSON.stringify(rules));
  }

  async cachedQuestions(): Promise<Question[]> {
    const row = await this.db.getFirstAsync<{ questions_json: string; rules_json: string }>(
      'SELECT questions_json, rules_json FROM intake_content WHERE version = ?', CONTENT_VERSION);
    if (!row || row.questions_json !== JSON.stringify(bank) || row.rules_json !== JSON.stringify(rules)) {
      throw new Error('Safety content is unavailable. Please restart the app.');
    }
    return (JSON.parse(row.questions_json) as typeof bank).questions;
  }

  async createIntake(id: string) {
    if (!id.trim()) throw new Error('Intake ID is required.');
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('INSERT INTO intake_sessions (id, content_version) VALUES (?, ?)', id, CONTENT_VERSION);
      // Only newly created intakes have a provable ordered history. Do not
      // invent ordering for old answer-only queues during schema migration.
      await tx.runAsync('INSERT INTO intake_sync_state (intake_id) VALUES (?)', id);
    });
    return id;
  }

  async latestIntake(): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM intake_sessions WHERE content_version = ? ORDER BY rowid DESC LIMIT 1', CONTENT_VERSION);
    return row?.id ?? null;
  }

  async saveContext(intakeId: string, context: SavedContext, gate?: GateOutput) {
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await this.checkIntake(tx, intakeId);
      await this.writeContext(tx, intakeId, context, gate);
    });
  }

  private async writeContext(tx: SqlConnection, id: string, context: SavedContext, gate?: GateOutput) {
    const snapshot = JSON.stringify(uploadContext(context, gate));
    const sync = await tx.getFirstAsync<{ last_context: string | null }>(
      'SELECT last_context FROM intake_sync_state WHERE intake_id = ?', id);
    await tx.runAsync('INSERT OR REPLACE INTO intake_context VALUES (?, ?)', id, JSON.stringify(context));
    if (sync && sync.last_context !== snapshot) {
      await this.enqueue(tx, id,
        JSON.stringify({ contentVersion: CONTENT_VERSION, kind: 'context',
          context: { ...JSON.parse(snapshot), recordedAt: new Date().toISOString() } }));
      await tx.runAsync('UPDATE intake_sync_state SET last_context = ? WHERE intake_id = ?', snapshot, id);
    }
  }

  private async enqueue(tx: SqlConnection, id: string, payload: string) {
    await tx.runAsync('INSERT INTO intake_outbox (intake_id, payload) VALUES (?, ?)', id, payload);
    const row = await tx.getFirstAsync<{ id: number }>('SELECT last_insert_rowid() AS id');
    if (!row) throw new Error('Could not record saved event.');
    await tx.runAsync('INSERT INTO intake_event_history VALUES (?, ?, ?)', row.id, id, payload);
  }

  async history(intakeId: string) {
    return this.db.getAllAsync<{ id: number; intake_id: string; payload: string }>(
      'SELECT * FROM intake_event_history WHERE intake_id = ? ORDER BY id', intakeId);
  }

  async context(intakeId: string): Promise<unknown> {
    await this.checkIntake(this.db, intakeId);
    const row = await this.db.getFirstAsync<{ payload: string }>('SELECT payload FROM intake_context WHERE intake_id = ?', intakeId);
    if (!row) throw new Error('No resumable app context for this intake.');
    return JSON.parse(row.payload);
  }

  private async checkIntake(db: SqlConnection, id: string) {
    const row = await db.getFirstAsync<{ content_version: string }>('SELECT content_version FROM intake_sessions WHERE id = ?', id);
    if (row?.content_version !== CONTENT_VERSION) throw new Error('Start a new intake for this safety content version.');
  }

  async saveAnswer(intakeId: string, answer: Answer, context?: SavedContext) {
    if (!isValidAnswer(answer)) throw new Error('Invalid answer. Nothing was saved.');
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await this.checkIntake(tx, intakeId);
      // Evidence and its reviewing answer are enqueued in the SAME transaction.
      if (context) await this.writeContext(tx, intakeId, context);
      await tx.runAsync(`INSERT INTO intake_answers VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(intake_id, question_id) DO UPDATE SET type=excluded.type,
        state=excluded.state, value_json=excluded.value_json, clarified=excluded.clarified`,
      intakeId, answer.questionId, answer.type, answer.state, JSON.stringify(answer.value), answer.clarificationAttempted ? 1 : 0);
      await this.enqueue(tx, intakeId,
        JSON.stringify({ contentVersion: CONTENT_VERSION, answer, recordedAt: new Date().toISOString() }));
    });
    return this.savedGate(intakeId);
  }

  async answers(intakeId: string): Promise<Answer[]> {
    await this.checkIntake(this.db, intakeId);
    const rows = await this.db.getAllAsync<{
      question_id: string; type: Answer['type']; state: Answer['state']; value_json: string; clarified: number;
    }>('SELECT * FROM intake_answers WHERE intake_id = ? ORDER BY rowid', intakeId);
    const answers = rows.map((r) => ({ questionId: r.question_id, type: r.type,
      state: r.state, value: JSON.parse(r.value_json), clarificationAttempted: r.clarified === 1 }));
    if (!answers.every(isValidAnswer)) throw new Error('Saved safety answers are invalid. Clinical review required.');
    return answers;
  }

  async savedGate(intakeId: string) {
    await this.cachedQuestions();
    return evaluate(await this.answers(intakeId));
  }

  async pending(intakeId?: string): Promise<QueueItem[]> {
    return intakeId === undefined ? this.db.getAllAsync<QueueItem>('SELECT * FROM intake_outbox ORDER BY id')
      : this.db.getAllAsync<QueueItem>('SELECT * FROM intake_outbox WHERE intake_id = ? ORDER BY id', intakeId);
  }

  /** One selected intake/account; ordered delivery, stable keys, no silent legacy migration. */
  async syncOrdered(intakeId: string, identity: string, send: (event: OrderedSyncEvent) => Promise<void>) {
    if (this.syncing) throw new Error('An upload is already running.');
    if (!identity.trim()) throw new Error('Sign in before uploading.');
    this.syncing = true;
    try {
      await this.db.withExclusiveTransactionAsync(async (tx) => {
        await this.checkIntake(tx, intakeId);
        const sync = await tx.getFirstAsync<{ identity: string | null }>(
          'SELECT identity FROM intake_sync_state WHERE intake_id = ?', intakeId);
        if (!sync) throw new Error('This older assessment has no ordered upload history. Start a new assessment; its data is retained.');
        if (sync.identity && sync.identity !== identity) throw new Error('This assessment is linked to a different account or server.');
        await tx.runAsync('UPDATE intake_sync_state SET identity = ? WHERE intake_id = ?', identity, intakeId);
      });
      let sent = 0;
      for (const item of await this.pending(intakeId)) {
        const payload = JSON.parse(item.payload);
        if (payload.contentVersion !== CONTENT_VERSION || (payload.kind === 'context'
          ? !payload.context || !Array.isArray(payload.context.appAnswers) || !Array.isArray(payload.context.movements)
          : !isValidAnswer(payload.answer))) throw new Error('Queued content is invalid. Sync stopped; data retained.');
        await this.db.runAsync('UPDATE intake_outbox SET attempts = attempts + 1 WHERE id = ?', item.id);
        await send({ ...payload, kind: payload.kind === 'context' ? 'context' : 'answer',
          intakeId, idempotencyKey: `${intakeId}:${item.id}` });
        await this.db.runAsync('DELETE FROM intake_outbox WHERE id = ?', item.id);
        sent++;
      }
      return { sent, remaining: (await this.pending(intakeId)).length };
    } finally { this.syncing = false; }
  }

  // Legacy answer-only interface, retained for earlier integrations/tests.
  // The app uses syncOrdered with authenticated ApiClient acknowledgements.
  // This interface stops at a context event rather than silently skipping it.
  async sync(send: (event: SyncEvent) => Promise<void>) {
    if (this.syncing) return;
    this.syncing = true;
    try {
      for (const item of await this.pending()) {
        const payload = JSON.parse(item.payload) as Pick<SyncEvent, 'answer' | 'contentVersion'>;
        if (!isValidAnswer(payload.answer) || payload.contentVersion !== CONTENT_VERSION) {
          throw new Error('Queued answer content is invalid. Sync stopped.');
        }
        await this.db.runAsync('UPDATE intake_outbox SET attempts = attempts + 1 WHERE id = ?', item.id);
        await send({ ...payload, intakeId: item.intake_id, idempotencyKey: `${item.intake_id}:${item.id}` });
        await this.db.runAsync('DELETE FROM intake_outbox WHERE id = ?', item.id);
      }
    } finally { this.syncing = false; }
  }
}
