import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBlurAllowed } from './blur';
import { useTheme } from './ThemeProvider';
import { MIN_TOUCH, corner, font, softShadow } from './theme';

export interface NavItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon?: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}

interface Props {
  /** Four items; the centre button sits between the first two and the last two. */
  items: NavItem[];
  centerLabel: string;
  onCenter: () => void;
}

/** Floating glass bottom bar with a raised centre "+" button. Role-specific tabs are passed as items. */
export function GlassNav({ items, centerLabel, onCenter }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const blurOk = useBlurAllowed();
  const half = Math.ceil(items.length / 2);
  const render = (it: NavItem) => {
    const fg = it.active ? colors.accentText : colors.muted;
    return (
      <Pressable
        key={it.key}
        accessibilityRole="tab"
        accessibilityLabel={it.label}
        accessibilityState={{ selected: it.active }}
        onPress={it.onPress}
        style={styles.item}
      >
        <Ionicons name={it.active && it.activeIcon ? it.activeIcon : it.icon} size={24} color={fg} />
        <Text style={[font.caption, { color: fg, fontSize: 12, lineHeight: 16, fontWeight: it.active ? '800' : '600' }]} numberOfLines={1}>
          {it.label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: blurOk ? colors.glassFill : colors.surface, borderColor: colors.glassBorder }, softShadow(colors, 1.4)]}>
        {blurOk ? <BlurView intensity={45} tint={colors.blurTint} style={StyleSheet.absoluteFill} /> : null}
        {items.slice(0, half).map(render)}
        <View style={styles.centerSlot} />
        {items.slice(half).map(render)}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={centerLabel}
        onPress={onCenter}
        style={({ pressed }) => [styles.center, { backgroundColor: colors.accentFill, borderColor: colors.glassBorder, bottom: Math.max(insets.bottom, 12) + 28 }, softShadow(colors, 1.6), pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="add" size={32} color={colors.onAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 0, end: 0, bottom: 0, paddingHorizontal: 16 },
  bar: { height: 68, flexDirection: 'row', alignItems: 'center', borderRadius: corner.sheet + 8, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 8 },
  item: { flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', gap: 2 },
  centerSlot: { width: 72 },
  center: { position: 'absolute', alignSelf: 'center', width: 60, height: 60, borderRadius: 30, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
