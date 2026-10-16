import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { palettes } from './theme';
import type { Palette, Scheme } from './theme';

export type ThemePref = 'system' | 'light' | 'dark';

/** The manual choice from Profile. "system" follows the phone setting. */
export const useThemePref = create<{ pref: ThemePref; setPref: (p: ThemePref) => void }>((set) => ({
  pref: 'system',
  setPref: (pref) => set({ pref }),
}));

interface ThemeValue {
  scheme: Scheme;
  colors: Palette;
}
const Ctx = createContext<ThemeValue>({ scheme: 'light', colors: palettes.light });

/** Resolves light or dark once at the app root. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const pref = useThemePref((s) => s.pref);
  const scheme: Scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const value = useMemo(() => ({ scheme, colors: palettes[scheme] }), [scheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Forces a palette for a subtree (the 3D screen is always "scene", whatever the app mode). */
export function ThemeScope({ scheme, children }: { scheme: Scheme; children: React.ReactNode }) {
  const value = useMemo(() => ({ scheme, colors: palettes[scheme] }), [scheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Colours for the current screen. Without a provider (tests) this is the light palette. */
export function useTheme(): ThemeValue {
  return useContext(Ctx);
}
