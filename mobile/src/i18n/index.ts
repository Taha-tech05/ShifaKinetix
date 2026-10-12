import { I18nManager } from 'react-native';
import { en } from './en';
import type { Translations } from './en';
import { roman } from './roman';
import { ur } from './ur';

export type Language = 'en' | 'ur' | 'roman';

export const LANGUAGES: Language[] = ['en', 'ur', 'roman'];

const dictionaries: Record<Language, Translations> = { en, ur, roman };

let current: Language = 'en';

type Path<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Path<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Path<typeof en>;

function lookup(dict: Translations, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in node) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === 'string' ? node : undefined;
}

/** Translate a key in the current language, falling back to English. `{{name}}` is replaced from params. */
export function t(key: TKey, params?: Record<string, string | number>): string {
  const text = lookup(dictionaries[current], key) ?? lookup(en, key) ?? key;
  if (!params) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{{${name}}}`,
  );
}

export function getLanguage(): Language {
  return current;
}

export function isRTL(lang: Language): boolean {
  return lang === 'ur';
}

/**
 * Set the active language and align I18nManager. Urdu is RTL; the layout only
 * mirrors fully after the app restarts, which is why `needsRestart` is returned.
 */
export function setLanguage(lang: Language): { needsRestart: boolean } {
  current = lang;
  const rtl = isRTL(lang);
  I18nManager.allowRTL(rtl);
  const needsRestart = I18nManager.isRTL !== rtl;
  I18nManager.forceRTL(rtl);
  return { needsRestart };
}
