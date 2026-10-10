import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, MIN_TAP, radius, shadows, spacing } from '../theme';
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

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
  fullWidth = true,
  style,
}: Props) {
  const textColor = variant === 'primary' ? colors.white : colors.teal;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'outline' && styles.outline,
        fullWidth && styles.full,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.row}>
        {icon ? <Ionicons name={icon} size={20} color={textColor} /> : null}
        <AppText variant="button" color={textColor}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TAP,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  primary: { backgroundColor: colors.teal, minHeight: 52, ...shadows.button },
  outline: { borderWidth: 2, borderColor: colors.teal, backgroundColor: colors.white },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
