// Stand-in for the saved safety intake in the screen tests that inject a gate outcome (see narrowingGateFixture.tsx).
// The checkpoint "succeeds" the way a working SQLite write does: it saves nothing, keeps the injected verdict and resolves.
// Persistence itself is covered by liveDurability.test.tsx (failure paths) and the SQLite suite.
import { useSession } from '../../src/store/session';

export const savedSafetySession = () => ({
  openSafetySession: async () => ({
    checkpoint: async () => useSession.getState().gateOutput ?? { verdict: useSession.getState().gateVerdict, firedRules: [] },
  }),
});
