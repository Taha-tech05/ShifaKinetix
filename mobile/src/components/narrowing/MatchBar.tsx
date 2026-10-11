import { StyleSheet, View } from 'react-native';
import type { Band } from '../../narrowing/config';
import { colors } from '../../theme';

const FILL: Record<Band, string> = { low: '#9AA9B7', moderate: colors.cautionBase, higher: colors.teal };

/**
 * A simple match bar. It shows how well the muscle matches what was reported: a band colour and a fill. It is a match
 * strength, not a probability, and it carries no number.
 */
export function MatchBar({ strength, band }: { strength: number; band: Band }) {
  const s = Math.min(1, Math.max(0.04, strength));
  return (
    <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ flex: s, backgroundColor: FILL[band], borderRadius: 3 }} />
      <View style={{ flex: 1 - s }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
});
