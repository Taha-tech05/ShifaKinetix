import { useCallback } from 'react';
import { create } from 'zustand';
import { setLanguage, t } from '../i18n';
import type { Language, TKey } from '../i18n';

interface SettingsState {
  language: Language | null;
  signedIn: boolean;
  consented: boolean;
  offline: boolean;
  /** True when switching to/from Urdu needs an app restart to fully mirror the layout. */
  needsRestart: boolean;
  chooseLanguage: (lang: Language) => void;
  signIn: () => void;
  signOut: () => void;
  giveConsent: () => void;
  setOffline: (offline: boolean) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  language: null,
  signedIn: false,
  consented: false,
  offline: false,
  needsRestart: false,
  chooseLanguage: (language) => {
    const { needsRestart } = setLanguage(language);
    set({ language, needsRestart });
  },
  signIn: () => set({ signedIn: true }),
  signOut: () => set({ signedIn: false, consented: false }),
  giveConsent: () => set({ consented: true }),
  setOffline: (offline) => set({ offline }),
}));

/** Re-renders the calling component when the language changes. */
export function useT() {
  const language = useSettings((s) => s.language);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((key: TKey, params?: Record<string, string | number>) => t(key, params), [language]);
}
