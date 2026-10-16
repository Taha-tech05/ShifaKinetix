import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MIN_TAP, radius } from '../theme';
import { useTheme } from '../ui/ThemeProvider';
import { softShadow } from '../ui/theme';
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

/** Primary: filled accent, 56 high, large radius. Outline: glass with a border. Text: underlined link. */
export function Button({ label, onPress, variant = 'primary', disabled = false, icon, fullWidth = true, style }: Props) {
  const { colors } = useTheme();
  const isText = variant === 'text';
  const textColor = variant === 'primary' ? (disabled ? colors.disabledText : colors.onAccent) : variant === 'outline' ? colors.text : colors.accentText;
  const fill =
    variant === 'primary'
      ? { height: 56, backgroundColor: disabled ? colors.disabled : colors.accentFill, ...(disabled ? null : softShadow(colors, 1.3)) }
      : variant === 'outline'
        ? { height: 56, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.glassFill }
        : { height: 48, backgroundColor: 'transparent' };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.base, fill, fullWidth && styles.full, pressed && styles.pressed, style]}
    >
      <View style={styles.row}>
        {icon ? <Ionicons name={icon} size={20} color={textColor} /> : null}
        <AppText variant="button" color={textColor} style={isText ? styles.underline : undefined}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: MIN_TAP, paddingHorizontal: 16, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  full: { alignSelf: 'stretch' },
  underline: { textDecorationLine: 'underline' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pressed: { opacity: 0.85 },
});
