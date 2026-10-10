import bank from '../../../shared/questions_shoulder.json';
import rules from '../../../shared/gate_rules.json';
import { Answer, CONTENT_VERSION, evaluate, isValidAnswer, Question } from '../gate/evaluate';

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
        version TEXT PRIMARY KEY, questions_json TEXT NOT NULL, rules_json TEXT NOT NULL);`);
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
    await this.db.runAsync('INSERT INTO intake_sessions (id, content_version) VALUES (?, ?)', id, CONTENT_VERSION);
    return id;
  }

  async latestIntake(): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM intake_sessions WHERE content_version = ? ORDER BY rowid DESC LIMIT 1', CONTENT_VERSION);
    return row?.id ?? null;
  }

  private async checkIntake(db: SqlConnection, id: string) {
    const row = await db.getFirstAsync<{ content_version: string }>('SELECT content_version FROM intake_sessions WHERE id = ?', id);
    if (row?.content_version !== CONTENT_VERSION) throw new Error('Start a new intake for this safety content version.');
  }

  async saveAnswer(intakeId: string, answer: Answer) {
    if (!isValidAnswer(answer)) throw new Error('Invalid answer. Nothing was saved.');
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await this.checkIntake(tx, intakeId);
      await tx.runAsync(`INSERT INTO intake_answers VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(intake_id, question_id) DO UPDATE SET type=excluded.type,
        state=excluded.state, value_json=excluded.value_json, clarified=excluded.clarified`,
      intakeId, answer.questionId, answer.type, answer.state, JSON.stringify(answer.value), answer.clarificationAttempted ? 1 : 0);
      await tx.runAsync('INSERT INTO intake_outbox (intake_id, payload) VALUES (?, ?)', intakeId,
        JSON.stringify({ contentVersion: CONTENT_VERSION, answer }));
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

  async pending(): Promise<QueueItem[]> {
    return this.db.getAllAsync<QueueItem>('SELECT * FROM intake_outbox ORDER BY id');
  }

  // C supplies an authenticated transport. Resolve only after server acknowledgement.
  // The server must deduplicate idempotencyKey. Failure preserves the ordered queue.
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
