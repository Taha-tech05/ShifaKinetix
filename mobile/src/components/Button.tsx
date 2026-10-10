import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, MIN_TAP, radius, shadows } from '../theme';
import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'outline' | 'text';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Primary: teal, 56 high, radius 20 (design .btn). Outline: white with navy border (.btn.line). Text: underlined link (.txt). */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
  fullWidth = true,
  style,
}: Props) {
  const isText = variant === 'text';
  const textColor =
    variant === 'primary'
      ? disabled
        ? colors.disabledText
        : colors.white
      : variant === 'outline'
        ? colors.navy
        : colors.linkTeal;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && (disabled ? styles.primaryOff : styles.primary),
        variant === 'outline' && styles.outline,
        isText && styles.text,
        fullWidth && styles.full,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.row}>
        {icon ? <Ionicons name={icon} size={20} color={textColor} /> : null}
        <AppText
          variant="button"
          color={textColor}
          style={isText ? styles.underline : undefined}
        >
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TAP,
    paddingHorizontal: 16,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  primary: { height: 56, backgroundColor: colors.teal, ...shadows.button },
  primaryOff: { height: 56, backgroundColor: colors.disabled },
  outline: { height: 56, borderWidth: 2, borderColor: colors.navy, backgroundColor: colors.white },
  text: { height: 48, backgroundColor: 'transparent' },
  underline: { textDecorationLine: 'underline' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pressed: { opacity: 0.85 },
});
