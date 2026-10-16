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
  style?: StyleProp<ViewStyle>;
}

/** Pill chip (filter or answer). Selected is filled with the accent colour. */
export function Chip({ label, icon, selected = false, onPress, large = false, disabled = false, style }: Props) {
  const { colors } = useTheme();
  const fg = selected ? colors.onAccent : colors.text;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { minHeight: large ? 52 : MIN_TOUCH, backgroundColor: selected ? colors.accentFill : colors.glassFill, borderColor: selected ? colors.accentFill : colors.glassBorder },
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
      <Text style={[font.caption, styles.label, { color: fg }]} numberOfLines={3}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  label: { fontWeight: '700', textAlign: 'center' },
});
