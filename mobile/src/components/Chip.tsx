import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, MIN_TAP, shadows } from '../theme';
import { AppText } from './AppText';

interface Props {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
  onPress?: () => void;
}

/** Category chip (design .chp): 48 high, radius 24, white; selected is filled teal. */
export function Chip({ label, icon, selected = false, onPress }: Props) {
  const fg = selected ? colors.white : colors.navy;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected }}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      {icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
      <AppText variant="secondary" color={fg} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: MIN_TAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    ...shadows.card,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  selected: { backgroundColor: colors.teal, borderColor: colors.teal },
  label: { fontWeight: '600' },
});
