import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useTheme } from './ThemeProvider';

/** Diagonal screen gradient with three soft translucent bubbles (decoration only). */
export function GradientBackground() {
  const { colors } = useTheme();
  return (
    <View style={styles.fill} importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <LinearGradient colors={[...colors.gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill} />
      <View style={[styles.bubble, styles.b1, { backgroundColor: colors.bubbles[0] }]} />
      <View style={[styles.bubble, styles.b2, { backgroundColor: colors.bubbles[1] }]} />
      <View style={[styles.bubble, styles.b3, { backgroundColor: colors.bubbles[2] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...(StyleSheet.absoluteFill as object) },
  bubble: { position: 'absolute', borderRadius: 999 },
  b1: { width: 220, height: 220, top: -60, end: -70 },
  b2: { width: 160, height: 160, top: '42%', start: -70 },
  b3: { width: 120, height: 120, bottom: 90, end: 24 },
});
