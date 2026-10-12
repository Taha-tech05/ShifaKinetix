import { useEffect, useState } from 'react';
import { disposePack, loadPack } from '../../screens/model3d/loadPack';
import type { LoadedPack } from '../../screens/model3d/loadPack';
import { LITE_BIN, LITE_META } from './pack';

// One loaded pack shared by every screen that shows the 3D body (P5 and the result), so the 39 MB file is read and
// parsed once. It is released 15 seconds after the last screen stops using it.
let shared: { promise: Promise<LoadedPack>; pack: LoadedPack | null; users: number; timer: ReturnType<typeof setTimeout> | null } | null = null;
const RELEASE_MS = 15000;

export type PackState = { status: 'loading' | 'ready' | 'failed'; pack: LoadedPack | null };

function acquire() {
  if (!shared) {
    const entry = { promise: loadPack(LITE_BIN, LITE_META), pack: null as LoadedPack | null, users: 0, timer: null as ReturnType<typeof setTimeout> | null };
    entry.promise.then((p) => (entry.pack = p)).catch(() => {
      if (shared === entry) shared = null; // allow a retry on the next visit
    });
    shared = entry;
  }
  if (shared.timer) {
    clearTimeout(shared.timer);
    shared.timer = null;
  }
  shared.users++;
  return shared;
}

function release(entry: NonNullable<typeof shared>) {
  entry.users--;
  if (entry.users > 0) return;
  entry.timer = setTimeout(() => {
    if (shared === entry && entry.users === 0) {
      shared = null;
      entry.promise.then(disposePack).catch(() => undefined);
    }
  }, RELEASE_MS);
}

/** Loads the lite pack (shared). `enabled` false skips loading and reports "failed". */
export function usePack(enabled = true): PackState {
  const [state, setState] = useState<PackState>({ status: enabled ? 'loading' : 'failed', pack: null });
  // a pack from before the screen was left may have been released, so switching back on starts from "loading"
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (enabled) setState({ status: 'loading', pack: null });
  }
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const entry = acquire();
    entry.promise
      .then((p) => !cancelled && setState({ status: 'ready', pack: p }))
      .catch(() => !cancelled && setState({ status: 'failed', pack: null }));
    return () => {
      cancelled = true;
      release(entry);
    };
  }, [enabled]);
  return state;
}
