import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { MIN_TOUCH, font } from './theme';

interface Props {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
  onPress?: () => void;
  /** A large chip for answers inside the chat (min height 52). */
  large?: boolean;
  disabled?: boolean;
  /** Colour role of the chip when it is only a tag (not pressable): e.g. "May be involved". */
  tone?: 'default' | 'region' | 'involved' | 'warn' | 'ai';
  style?: StyleProp<ViewStyle>;
}

/** Pill chip (filter or answer). Unselected: outlined. Selected: solid accent. Tags can carry a colour role. */
export function Chip({ label, icon, selected = false, onPress, large = false, disabled = false, tone = 'default', style }: Props) {
  const { colors } = useTheme();
  const role =
    tone === 'region' ? { bg: colors.pin, fg: colors.onAccent, border: colors.pin }
    : tone === 'involved' ? { bg: colors.involvedTint, fg: colors.involved, border: colors.involved }
    : tone === 'warn' ? { bg: colors.cautionTint, fg: colors.caution, border: colors.cautionBase }
    : tone === 'ai' ? { bg: colors.aiTint, fg: colors.ai, border: colors.ai }
    : null;
  const bg = role ? role.bg : selected ? colors.accentFill : 'transparent';
  const fg = role ? role.fg : selected ? colors.onAccent : colors.text;
  const border = role ? role.border : selected ? colors.accentFill : colors.lineStrong;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { minHeight: large ? 52 : MIN_TOUCH, backgroundColor: bg, borderColor: border }, pressed && { opacity: 0.85 }, disabled && { opacity: 0.5 }, style]}
    >
      {icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
      <Text style={[font.caption, styles.label, { color: fg }]} numberOfLines={3}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },
  label: { fontWeight: '700', textAlign: 'center' },
});
