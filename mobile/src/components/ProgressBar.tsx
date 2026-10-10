import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';

/** `value` is 0 to 1. */
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.neutralTint, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.teal },
});
