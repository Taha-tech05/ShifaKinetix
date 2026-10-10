import { openDatabaseAsync } from 'expo-sqlite';
import { IntakeStore } from './intakeStore';

let current: Promise<IntakeStore> | undefined;
export function openIntakeStore(): Promise<IntakeStore> {
  if (!current) {
    current = (async () => {
      const db = await openDatabaseAsync('shifakinetix-intake.db');
      const store = new IntakeStore(db);
      await store.initialize();
      return store;
    })().catch((error) => { current = undefined; throw error; });
  }
  return current;
}
