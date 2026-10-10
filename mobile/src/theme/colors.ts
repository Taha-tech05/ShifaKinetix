// Extracted from docs/design/ShifaKinetix-Unified.html (:root tokens).
export const colors = {
  navy: '#1A2E40',
  navyLight: '#24425A',
  teal: '#2F7F7F', // actions
  tealSoft: '#4E9F9F', // decorative only (fails 4.5:1 for text on white)
  tealDark: '#1A5F5F',
  background: '#FFFFFF',
  surface: '#F4F6F8',
  ink: '#2C3E50',
  muted: '#5B6B7B', // 5.6:1 on white
  line: '#E1E6EB',
  lineStrong: '#C5D0DA',
  danger: '#C0392B',
  dangerDark: '#A93226',
  caution: '#8A5A00', // text on cautionTint
  cautionBase: '#B7791F',
  safe: '#1F6B4A',
  tealTint: '#E3F1F1', // mint banner
  neutralTint: '#E6ECF2',
  cautionTint: '#FBF1DC',
  dangerTint: '#FBE9E7',
  safeTint: '#E4F3EC',
  white: '#FFFFFF',
} as const;

export type ColorName = keyof typeof colors;
