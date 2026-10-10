import type { ViewStyle } from 'react-native';
import { colors } from './colors';

// --sh / --sh2 from the design reference, mapped to RN shadow + elevation.
export const shadows = {
  card: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  raised: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
  button: {
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
  },
} as const satisfies Record<string, ViewStyle>;
