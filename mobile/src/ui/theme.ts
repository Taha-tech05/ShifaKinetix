// The one place colours are defined for the app UI. Screens read them with useTheme(); nothing else hard-codes a colour.
// Light is the default for all non-3D screens, dark follows Image 2's palette, and "scene" is the always-dark 3D screen.
import type { ViewStyle } from 'react-native';

export interface Palette {
  /** gradient behind every screen: top-left -> bottom-right */
  gradient: readonly [string, string];
  bubbles: readonly [string, string, string];
  text: string;
  muted: string;
  /** brand colour for icons and decoration */
  accent: string;
  /** brand colour for filled buttons (text on it is onAccent) */
  accentFill: string;
  /** brand colour for text on a glass card */
  accentText: string;
  accentTint: string;
  onAccent: string;
  /** dot / pin colour on the 3D body */
  pin: string;
  glassFill: string;
  glassBorder: string;
  /** flat card fill (no blur): used for everything that is not a floating layer */
  cardFill: string;
  surface: string;
  page: string;
  /** background of a selected chip and of the top bar */
  chrome: string;
  line: string;
  lineStrong: string;
  track: string;
  danger: string;
  dangerDark: string;
  dangerTint: string;
  caution: string;
  cautionBase: string;
  cautionTint: string;
  safe: string;
  safeTint: string;
  neutral: string;
  disabled: string;
  disabledText: string;
  scrim: string;
  shadow: string;
  blurTint: 'light' | 'dark';
}

export const lightPalette: Palette = {
  gradient: ['#C4EBE6', '#FDDCCB'],
  bubbles: ['rgba(255,255,255,0.45)', 'rgba(18,150,143,0.14)', 'rgba(255,255,255,0.35)'],
  text: '#15383A',
  muted: '#486A6B',
  accent: '#12968F',
  accentFill: '#0E7C76',
  accentText: '#0A6F69',
  accentTint: 'rgba(18,150,143,0.14)',
  onAccent: '#FFFFFF',
  pin: '#12968F',
  glassFill: 'rgba(255,255,255,0.58)',
  glassBorder: 'rgba(255,255,255,0.85)',
  cardFill: 'rgba(255,255,255,0.62)',
  surface: 'rgba(255,255,255,0.78)',
  page: '#E4F3F0',
  chrome: '#15383A',
  line: 'rgba(21,56,58,0.12)',
  lineStrong: 'rgba(21,56,58,0.28)',
  track: 'rgba(21,56,58,0.14)',
  danger: '#C8372D',
  dangerDark: '#A32B22',
  dangerTint: 'rgba(200,55,45,0.12)',
  caution: '#7A4E00',
  cautionBase: '#B7791F',
  cautionTint: 'rgba(255,236,190,0.92)',
  safe: '#1F6B4A',
  safeTint: 'rgba(31,107,74,0.12)',
  neutral: 'rgba(255,255,255,0.5)',
  disabled: 'rgba(21,56,58,0.14)',
  disabledText: '#3D5A5B',
  scrim: 'rgba(11,27,46,0.45)',
  shadow: '#15383A',
  blurTint: 'light',
};

export const darkPalette: Palette = {
  gradient: ['#1E4F73', '#0B1B2E'],
  bubbles: ['rgba(79,224,210,0.10)', 'rgba(255,255,255,0.06)', 'rgba(79,224,210,0.07)'],
  text: '#E8F4F3',
  muted: '#9BB7B8',
  accent: '#4FE0D2',
  accentFill: '#4FE0D2',
  accentText: '#4FE0D2',
  accentTint: 'rgba(79,224,210,0.16)',
  onAccent: '#0B1B2E',
  pin: '#C9F27A',
  glassFill: 'rgba(255,255,255,0.08)',
  glassBorder: 'rgba(255,255,255,0.16)',
  cardFill: 'rgba(255,255,255,0.08)',
  surface: 'rgba(255,255,255,0.12)',
  page: '#0B1B2E',
  chrome: '#4FE0D2',
  line: 'rgba(255,255,255,0.16)',
  lineStrong: 'rgba(255,255,255,0.34)',
  track: 'rgba(255,255,255,0.18)',
  danger: '#FF7A6E',
  dangerDark: '#FF9A90',
  dangerTint: 'rgba(255,122,110,0.16)',
  caution: '#F3D58A',
  cautionBase: '#F3C35C',
  cautionTint: 'rgba(243,195,92,0.16)',
  safe: '#7FE0B0',
  safeTint: 'rgba(127,224,176,0.14)',
  neutral: 'rgba(255,255,255,0.08)',
  disabled: 'rgba(255,255,255,0.14)',
  disabledText: '#B6CACB',
  scrim: 'rgba(0,0,0,0.55)',
  shadow: '#000000',
  blurTint: 'dark',
};

/** The 3D symptom screen is always dark: the existing deep blue studio look, in light and dark app mode. */
export const scenePalette: Palette = {
  ...darkPalette,
  gradient: ['#3D84AD', '#0D2036'],
  page: '#0D2036',
  glassFill: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.20)',
};

export type Scheme = 'light' | 'dark' | 'scene';
export const palettes: Record<Scheme, Palette> = { light: lightPalette, dark: darkPalette, scene: scenePalette };

/** 8pt grid. */
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
/** Corner radii: 20 to 28 for surfaces. */
export const corner = { card: 24, sheet: 28, pill: 999, tile: 20, button: 22 } as const;
export const MIN_TOUCH = 48;
/** Three text sizes per screen: title, body, caption. */
export const font = {
  title: { fontSize: 24, lineHeight: 32, fontWeight: '800' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
} as const;

export function softShadow(p: Palette, strength = 1): ViewStyle {
  return { shadowColor: p.shadow, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12 * strength, shadowRadius: 22, elevation: 4 };
}
