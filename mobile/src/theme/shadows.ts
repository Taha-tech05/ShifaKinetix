import type { ViewStyle } from 'react-native';
import { colors } from './colors';

// --sh / --sh2 from the design reference, mapped to RN shadow + elevation.
export const shadows = {
  card: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 22,
    elevation: 3,
  },
  raised: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
  nav: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  sos: {
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 7,
    elevation: 4,
  },
  button: {
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 13,
    elevation: 4,
  },
} as const satisfies Record<string, ViewStyle>;
