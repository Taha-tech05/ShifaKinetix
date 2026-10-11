import type { TextStyle } from 'react-native';

// Body 16, secondary never below 14.
export const typography = {
  display: { fontSize: 30, lineHeight: 38, fontWeight: '800' },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '800' },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  h3: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  secondary: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  button: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
} as const satisfies Record<string, TextStyle>;
