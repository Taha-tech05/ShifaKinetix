import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeProvider';
import { font, softShadow } from './theme';

export interface NavItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon?: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}

interface Props {
  items: NavItem[];
}

/** Height of a pill, and the width of the ring around it. */
const PILL = 54;
const RING = 6;
/** Width the label adds to the selected pill. */
const LABEL_W = 86;
const EASE = Easing.out(Easing.cubic);

/**
 * One button. The ring around it is part of one continuous shape: a neck of the same colour joins it to the next ring, so the bar reads as
 * round pills linked by pinched waists. The selected pill grows wider and shows its label; the change is animated.
 */
function NavButton({ item, first, last }: { item: NavItem; first: boolean; last: boolean }) {
  const { colors, scheme } = useTheme();
  const p = useSharedValue(item.active ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(item.active ? 1 : 0, { duration: 300, easing: EASE });
  }, [item.active, p]);
  const ring = useAnimatedStyle(() => ({ width: PILL + RING * 2 + p.value * (LABEL_W + 14) }));
  const label = useAnimatedStyle(() => ({ width: p.value * LABEL_W, opacity: p.value }));
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: 1 + p.value * 0.08 }] }));
  // light: teal for the selected tab; dark: white (the lime accent is kept for buttons, not for the bar)
  const fg = item.active ? (scheme === 'dark' ? colors.text : colors.accentText) : colors.muted;
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: item.active }} onPress={item.onPress} hitSlop={2}>
      <Animated.View style={[styles.ring, { backgroundColor: colors.accent, marginStart: first ? 0 : -2 }, ring]}>
        {last ? null : <View style={[styles.neck, { backgroundColor: colors.accent }]} />}
        <View style={[styles.pill, { backgroundColor: colors.navFill }]}>
          <Animated.View style={icon}>
            <Ionicons name={item.active && item.activeIcon ? item.activeIcon : item.icon} size={26} color={fg} />
          </Animated.View>
          <Animated.Text numberOfLines={1} style={[font.caption, styles.label, { color: fg }, label]}>
            {item.label}
          </Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/** Floating bottom bar in the shape of the reference: linked round pills inside one green outline, the selected one wider. */
export function GlassNav({ items }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={[styles.bar, softShadow(colors, 1.2)]}>
        {items.map((it, i) => (
          <NavButton key={it.key} item={it} first={i === 0} last={i === items.length - 1} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 0, end: 0, bottom: 0, alignItems: 'center' },
  // the rings overlap a little so that the colour is continuous between them
  bar: { flexDirection: 'row', alignItems: 'center' },
  ring: { height: PILL + RING * 2, borderRadius: (PILL + RING * 2) / 2, padding: RING },
  // the neck: a short bar of the ring colour that fills the gap to the next ring, thinner than the rings so the outline pinches in
  neck: { position: 'absolute', end: -12, top: 18, width: 24, height: PILL + RING * 2 - 36 },
  pill: { flex: 1, borderRadius: PILL / 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '700', marginStart: 8, textAlign: 'left' },
});
