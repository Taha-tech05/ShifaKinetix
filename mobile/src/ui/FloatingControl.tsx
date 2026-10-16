import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useBlurAllowed } from './blur';
import { useTheme } from './ThemeProvider';
import { MIN_TOUCH, font } from './theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** Show the label next to the icon (a pill) instead of the icon alone (a round button). */
  showLabel?: boolean;
  tone?: 'normal' | 'danger';
  /** Flip the icon in right-to-left layouts (arrows). */
  mirror?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Round or pill glass button that floats over the screen (back, replay, re-focus, reset view, SOS...). */
export function FloatingControl({ icon, label, onPress, showLabel = false, tone = 'normal', mirror = false, selected = false, style }: Props) {
  const { colors } = useTheme();
  const blurOk = useBlurAllowed();
  const fg = selected ? colors.onAccent : tone === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { minWidth: MIN_TOUCH, height: MIN_TOUCH, borderColor: colors.glassBorder, backgroundColor: selected ? colors.accentFill : blurOk ? colors.glassFill : colors.surface },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {blurOk ? <BlurView intensity={35} tint={colors.blurTint} style={StyleSheet.absoluteFill} /> : null}
      <View style={styles.row}>
        <Ionicons name={icon} size={22} color={fg} style={mirror && I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined} />
        {showLabel ? <Text style={[font.caption, { color: fg, fontWeight: '700' }]}>{label}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 999, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
