// The one place colours are defined for the app UI. Screens read them with useTheme(); nothing else hard-codes a colour.
// Every value is taken from the two reference images in docs/design:
//  - light: download.jpg  (teal-to-peach background, white glass, teal buttons and nav "+")
//  - dark:  994f54f213098931e5ce7d04ff63cbaa.webp  (steel-blue background, light glass, lime accent)
// "scene" is the palette of the symptom flow's sheet and floating controls: always the dark reference, in light and dark app mode.
// The 3D body itself keeps its original studio background (`studio`).
import type { ViewStyle } from 'react-native';

export interface Palette {
  /** gradient behind every screen: top-left -> bottom-right */
  /** gradient behind every screen, left to right (light) or top to bottom (dark) */
  gradient: readonly [string, string, string];
  /** true when the cards are (nearly) opaque, so a drop shadow can be drawn without showing through them */
  opaqueCards: boolean;
  text: string;
  muted: string;
  /** brand colour for icons and decoration */
  accent: string;
  /** brand colour for filled buttons: from -> to (text on it is onAccent) */
  accentFrom: string;
  accentFill: string;
  /** brand colour for text on a glass card */
  accentText: string;
  accentTint: string;
  onAccent: string;
  /** the selected body region: its chip, the tap label and the dot on the body */
  pin: string;
  glassFill: string;
  glassBorder: string;
  /** flat card fill (no blur): used for everything that is not a floating layer */
  cardFill: string;
  surface: string;
  /** frosted fill of the chat sheet: translucent, drawn over a blur (as the glass cards of the dark reference) */
  sheet: string;
  /** the same sheet when no blur can be drawn: nearly solid, so the text stays clear */
  sheetFallback: string;
  /** solid fill of small popovers (language menu, colour guide) and of the banner on the body */
  menuFill: string;
  /** fill of a bot message bubble (neutral) */
  bubble: string;
  /** fill of the floating controls that sit over the 3D body */
  controlFill: string;
  page: string;
  /** background of the top bar and of a selected chip */
  chrome: string;
  line: string;
  lineStrong: string;
  track: string;
  /** RED: red flag, SOS and emergency only. Used nowhere else. */
  danger: string;
  dangerDark: string;
  dangerTint: string;
  /** WARNING: safety and instruction notes, "not sure" clarifiers, the demo notice, errors. Always with a warning icon. */
  caution: string;
  cautionBase: string;
  cautionTint: string;
  /** muscles that may be involved (never red or orange, never a score) */
  involved: string;
  involvedTint: string;
  /** AI-generated content */
  ai: string;
  aiTint: string;
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
  // the reference's phone screens are frosted near-white: a faint teal at the left edge, a faint peach at the right
  gradient: ['#D6EEEA', '#F8F3EF', '#FBDDD0'],
  opaqueCards: true,
  text: '#0A2A2E',
  muted: '#456569',
  accent: '#0AABA7',
  accentFrom: '#0F9E9B',
  accentFill: '#0D817E',
  accentText: '#066E6B',
  accentTint: 'rgba(10,171,167,0.16)',
  onAccent: '#FFFFFF',
  pin: '#0D817E',
  glassFill: 'rgba(255,255,255,0.7)',
  glassBorder: 'rgba(255,255,255,0.95)',
  cardFill: '#FCFAF8',
  surface: '#FFFFFF',
  sheet: 'rgba(250,247,244,0.62)',
  sheetFallback: 'rgba(250,247,244,0.95)',
  menuFill: '#FFFFFF',
  bubble: 'rgba(255,255,255,0.9)',
  controlFill: 'rgba(255,255,255,0.86)',
  page: '#F8F3EF',
  chrome: '#0A2A2E',
  line: 'rgba(10,42,46,0.12)',
  lineStrong: 'rgba(10,42,46,0.3)',
  track: 'rgba(10,42,46,0.14)',
  danger: '#C8372D',
  dangerDark: '#A32B22',
  dangerTint: 'rgba(200,55,45,0.12)',
  caution: '#7A4E00',
  cautionBase: '#B7791F',
  cautionTint: 'rgba(255,236,190,0.94)',
  involved: '#0B6A82',
  involvedTint: 'rgba(11,106,130,0.14)',
  ai: '#5338B8',
  aiTint: 'rgba(83,56,184,0.12)',
  safe: '#1F6B4A',
  safeTint: 'rgba(31,107,74,0.12)',
  neutral: 'rgba(255,255,255,0.5)',
  disabled: 'rgba(10,42,46,0.14)',
  disabledText: '#3D5A5B',
  scrim: 'rgba(10,26,40,0.45)',
  shadow: '#4C6F6C',
  blurTint: 'light',
};

export const darkPalette: Palette = {
  gradient: ['#27527A', '#2D577B', '#34597A'],
  opaqueCards: false,
  text: '#FFFFFF',
  muted: '#E0EAF3',
  accent: '#C9F27A',
  accentFrom: '#C9F27A',
  accentFill: '#C9F27A',
  accentText: '#C9F27A',
  accentTint: 'rgba(201,242,122,0.18)',
  onAccent: '#10304A',
  pin: '#C9F27A',
  glassFill: 'rgba(255,255,255,0.12)',
  glassBorder: 'rgba(255,255,255,0.22)',
  cardFill: 'rgba(255,255,255,0.12)',
  surface: 'rgba(255,255,255,0.16)',
  sheet: 'rgba(46,84,120,0.58)',
  sheetFallback: 'rgba(46,84,120,0.96)',
  menuFill: '#2E5478',
  bubble: 'rgba(66,104,139,0.92)',
  controlFill: 'rgba(31,68,104,0.9)',
  page: '#2A5578',
  chrome: '#C9F27A',
  line: 'rgba(255,255,255,0.2)',
  lineStrong: 'rgba(255,255,255,0.45)',
  track: 'rgba(255,255,255,0.22)',
  danger: '#FF8A7E',
  dangerDark: '#FFA79E',
  dangerTint: 'rgba(255,138,126,0.2)',
  caution: '#FFE08A',
  cautionBase: '#FFD25E',
  cautionTint: 'rgba(255,210,94,0.2)',
  involved: '#8BE9F5',
  involvedTint: 'rgba(139,233,245,0.2)',
  ai: '#D2C6FF',
  aiTint: 'rgba(210,198,255,0.22)',
  safe: '#9BEBC0',
  safeTint: 'rgba(155,235,192,0.18)',
  neutral: 'rgba(255,255,255,0.1)',
  disabled: 'rgba(255,255,255,0.16)',
  disabledText: '#C9D8E6',
  scrim: 'rgba(5,15,28,0.55)',
  shadow: '#0B1B2E',
  blurTint: 'dark',
};

/** Kept for the unused result card; the symptom flow itself follows the app's light or dark palette. */
export const scenePalette: Palette = { ...darkPalette };

/** The 3D body's own background: unchanged from the original app (it is the same in light and dark mode). */
export const studio = ['#FFFFFF', '#E3F1F1', '#CFE0E8'] as const;

export type Scheme = 'light' | 'dark' | 'scene';
export const palettes: Record<Scheme, Palette> = { light: lightPalette, dark: darkPalette, scene: scenePalette };

/** 8pt grid. */
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
/** Corner radii: 20 to 28 for surfaces. */
export const corner = { card: 26, sheet: 28, pill: 999, tile: 20, button: 999 } as const;
export const MIN_TOUCH = 48;
/** Three text sizes per screen: title, body, caption. */
export const font = {
  title: { fontSize: 24, lineHeight: 32, fontWeight: '800' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
} as const;

/** Soft drop shadow. Android draws its elevation shadow through translucent fills as an ugly inner rectangle, so it is only used with opaque cards. */
export function softShadow(p: Palette, strength = 1): ViewStyle {
  return { shadowColor: p.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1 * strength, shadowRadius: 18, elevation: p.opaqueCards ? Math.round(3 * strength) : 0 };
}
