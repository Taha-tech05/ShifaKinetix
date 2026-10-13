import { createRequire } from 'node:module';
import { IntakeStore, SqlDatabase } from '../src/storage/intakeStore';

const { DatabaseSync } = createRequire(__filename)('node:sqlite') as typeof import('node:sqlite');
export function openDatabase(path: string) {
  const db = new DatabaseSync(path);
  const adapter: SqlDatabase = {
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
  return { db, store: new IntakeStore(adapter) };
}
