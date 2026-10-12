import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors, radius, shadows } from '../theme';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  tone?: 'white' | 'mint' | 'gray';
  /** Row layout with icon first, as most design cards (.card). */
  row?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** White card, radius 22, soft shadow, no border (design .card, v3). */
export function Card({ children, onPress, tone = 'white', row = false, accessibilityLabel, style }: Props) {
  const toneStyle = tone === 'mint' ? styles.mint : tone === 'gray' ? styles.gray : styles.white;
  const layout = row ? styles.row : null;
  if (!onPress) return <View style={[styles.base, toneStyle, layout, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.base, toneStyle, layout, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.card, padding: 16, minHeight: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  white: { backgroundColor: colors.white, ...shadows.card },
  mint: { backgroundColor: colors.tealTint },
  gray: { backgroundColor: colors.neutralTint },
  pressed: { opacity: 0.85 },
});
