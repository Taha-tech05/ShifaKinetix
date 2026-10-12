import { create } from 'zustand';

/**
 * Screen chrome that a screen can change while it is open. A compact screen (the question screen) draws its own single slim strip
 * with BOTH the demo message and the caution line, so the app-wide demo banner is not drawn above it.
 */
export const useChrome = create<{ compact: boolean; setCompact: (compact: boolean) => void }>((set) => ({
  compact: false,
  setCompact: (compact) => set({ compact }),
}));
