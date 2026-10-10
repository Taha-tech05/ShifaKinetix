import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '../theme';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  tone?: 'white' | 'mint' | 'gray';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, onPress, tone = 'white', accessibilityLabel, style }: Props) {
  const toneStyle = tone === 'mint' ? styles.mint : tone === 'gray' ? styles.gray : styles.white;
  if (!onPress) return <View style={[styles.base, toneStyle, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.base, toneStyle, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, padding: spacing.lg, minHeight: 48 },
  white: { backgroundColor: colors.white, ...shadows.card },
  mint: { backgroundColor: colors.tealTint },
  gray: { backgroundColor: colors.surface },
  pressed: { opacity: 0.85 },
});
