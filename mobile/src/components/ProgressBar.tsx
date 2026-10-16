import { StyleSheet, View } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '../ui/ThemeProvider';
import type { Palette } from '../ui/theme';

/** `value` is 0 to 1. Grey track, teal gradient fill (design .prog). */
export function ProgressBar({ value }: { value: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: colors.accent }]} />
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
