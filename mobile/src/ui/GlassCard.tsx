import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useBlurAllowed } from './blur';
import { useTheme } from './ThemeProvider';
import { corner, softShadow } from './theme';

interface Props {
  children?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Draw a real blur. Only for floating layers; ordinary cards stay flat (translucent fill, border, soft shadow). */
  blur?: boolean;
  /** More transparent fill (the dashboard): the background shade shows through. */
  airy?: boolean;
  row?: boolean;
  padding?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Frosted card: translucent white (or dark glass), 1px border, large radius, soft shadow. */
export function GlassCard({ children, onPress, accessibilityLabel, blur = false, airy = false, row = false, padding = 16, radius = corner.card, style }: Props) {
  const { colors } = useTheme();
  const blurOk = useBlurAllowed() && blur;
  const base: ViewStyle = {
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: blurOk ? colors.glassFill : airy ? colors.dashFill : colors.cardFill,
    overflow: blurOk ? 'hidden' : 'visible',
    padding,
    ...softShadow(colors),
    ...(row ? { flexDirection: 'row', alignItems: 'center', gap: 12 } : null),
  };
  const inner = (
    <>
      {blurOk ? <BlurView intensity={40} tint={colors.blurTint} style={StyleSheet.absoluteFill} /> : null}
      {children}
    </>
  );
  if (!onPress) return <View style={[base, style]}>{inner}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [base, { minHeight: 48 }, pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] }, style]}>
      {inner}
    </Pressable>
  );
}
