import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MIN_TAP } from '../theme';
import { useTheme } from '../ui/ThemeProvider';
import { softShadow } from '../ui/theme';
import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'outline' | 'text';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** An icon sits in a small round badge at the end of the button ("Get Started ->", "Add New Record +"). */
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Primary: gradient pill, 56 high, label centred, optional round icon badge. Outline: glass pill with a border. Text: underlined link. */
export function Button({ label, onPress, variant = 'primary', disabled = false, icon, fullWidth = true, style }: Props) {
  const { colors } = useTheme();
  const isText = variant === 'text';
  const textColor = variant === 'primary' ? (disabled ? colors.disabledText : colors.onAccent) : variant === 'outline' ? colors.text : colors.accentText;
  const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
  const custom = flat?.backgroundColor; // a caller can still give the button its own fill (the red-flag "Connect" button)
  const fill =
    variant === 'primary'
      ? { height: 56, ...(disabled ? { backgroundColor: colors.disabled } : softShadow(colors, 1.3)) }
      : variant === 'outline'
        ? { height: 56, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.glassFill }
        : { height: 48, backgroundColor: 'transparent' };
  const gradient = variant === 'primary' && !disabled && !custom;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.base, fill, fullWidth && styles.full, pressed && styles.pressed, style]}
    >
      {gradient ? <LinearGradient colors={[colors.accentFrom, colors.accentFill]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient} /> : null}
      <View style={styles.row}>
        <AppText variant="button" color={textColor} style={isText ? styles.underline : undefined}>
          {label}
        </AppText>
      </View>
      {icon ? (
        <View style={[styles.badge, { backgroundColor: variant === 'primary' ? colors.onAccent : colors.accentTint }]}>
          <Ionicons name={icon} size={20} color={variant === 'primary' ? colors.accentFill : colors.accentText} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: MIN_TAP, paddingHorizontal: 20, borderRadius: 999, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexDirection: 'row' },
  gradient: { ...(StyleSheet.absoluteFill as object) },
  full: { alignSelf: 'stretch' },
  underline: { textDecorationLine: 'underline' },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  badge: { position: 'absolute', end: 8, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.88 },
});
