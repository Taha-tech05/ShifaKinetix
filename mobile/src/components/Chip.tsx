import { Pressable, StyleSheet } from 'react-native';
import { colors, MIN_TAP, radius, spacing } from '../theme';
import { AppText } from './AppText';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected }}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected, onPress ? styles.tappable : null]}
    >
      <AppText variant="secondary" color={selected ? colors.white : colors.navy} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
  },
  tappable: { minHeight: MIN_TAP },
  selected: { backgroundColor: colors.teal, borderColor: colors.teal },
  label: { fontWeight: '600' },
});
