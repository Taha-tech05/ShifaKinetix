import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useTheme } from './ThemeProvider';

/**
 * The screen background. Light: a frosted near-white with a faint teal edge on the left and a faint peach edge on the right (as the
 * screens of the light reference). Dark: the steel blue of the dark reference. Three stops, so the middle never turns grey.
 */
export function GradientBackground() {
  const { colors, scheme } = useTheme();
  const vertical = scheme !== 'light';
  return (
    <View style={styles.fill} importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <LinearGradient
        colors={[...colors.gradient]}
        start={vertical ? { x: 0.5, y: 0 } : { x: 0, y: 0.15 }}
        end={vertical ? { x: 0.5, y: 1 } : { x: 1, y: 0.85 }}
        style={styles.fill}
      />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { ...(StyleSheet.absoluteFill as object) } });
