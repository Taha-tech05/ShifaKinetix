
import { I18nManager, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useTheme } from './ThemeProvider';
import { font } from './theme';

export interface CalloutProps {
  /** The region name (the same one the confirm step shows). Nothing else is ever shown here. */
  label: string;
  /** Projected screen position of the tapped 3D point, in this view's pixels. Updated every frame without re-rendering. */
  x: SharedValue<number>;
  y: SharedValue<number>;
  /** 1 while the point faces the camera, 0 when it has rotated behind the model. */
  facing: SharedValue<number>;
  /** Size of the area the callout may use, and the y where the bottom sheet starts. */
  width: number;
  height: number;
  /** Space reserved at the top (floating controls) and the bottom (sheet), so the pill never sits under them. */
  topInset: number;
  bottomInset: number;
  reduceMotion?: boolean;
}

const PILL_H = 40;
const GAP_X = 48;
const GAP_Y = 52;
const MARGIN = 12;

/**
 * A glass pill naming the tapped body part, joined by a thin line to a glowing pulsing dot at the tapped 3D point.
 * The position comes from shared values, so rotating or zooming moves it on the UI thread with no React render.
 * It flips left/right near the screen edges, stays above the bottom sheet, mirrors in right-to-left layouts and fades out
 * when the point turns away from the camera.
 */
export function Callout({ label, x, y, facing, width, height, topInset, bottomInset, reduceMotion = false }: CalloutProps) {
  const { colors } = useTheme();
  const pw = useSharedValue(120);
  const pulse = useSharedValue(0);
  const rtl = I18nManager.isRTL;
  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0.5;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
  }, [pulse, reduceMotion]);

  // where the pill sits relative to the dot: side (-1 left, 1 right) and above or below
  const place = (px: number, py: number) => {
    'worklet';
    let side = rtl ? -1 : 1;
    if (side === 1 && px + GAP_X + pw.value + MARGIN > width) side = -1;
    if (side === -1 && px - GAP_X - pw.value - MARGIN < 0) side = 1;
    let up = -1;
    if (py - GAP_Y < topInset) up = 1;
    if (py + GAP_Y + PILL_H > height - bottomInset) up = -1;
    let cx = side === 1 ? px + GAP_X : px - GAP_X - pw.value;
    cx = Math.min(width - pw.value - MARGIN, Math.max(MARGIN, cx));
    let cy = up === -1 ? py - GAP_Y : py + GAP_Y - PILL_H;
    cy = Math.min(height - bottomInset - PILL_H - MARGIN, Math.max(topInset, cy));
    return { cx, cy };
  };

  const dotStyle = useAnimatedStyle(() => ({
    opacity: facing.value,
    transform: [{ translateX: x.value - 8 }, { translateY: y.value - 8 }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: facing.value * (1 - pulse.value) * 0.7,
    transform: [{ translateX: x.value - 18 }, { translateY: y.value - 18 }, { scale: 0.6 + pulse.value * 0.8 }],
  }));
  const pillStyle = useAnimatedStyle(() => {
    const p = place(x.value, y.value);
    return { opacity: facing.value, transform: [{ translateX: p.cx }, { translateY: p.cy }] };
  });
  const lineStyle = useAnimatedStyle(() => {
    const p = place(x.value, y.value);
    // the line runs from the dot to the nearest middle edge of the pill
    const tx = x.value < p.cx + pw.value / 2 ? p.cx : p.cx + pw.value;
    const ty = p.cy + PILL_H / 2;
    const dx = tx - x.value;
    const dy = ty - y.value;
    const len = Math.sqrt(dx * dx + dy * dy);
    return {
      opacity: facing.value,
      width: len,
      transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${Math.atan2(dy, dx)}rad` }],
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden={false}>
      <Animated.View style={[styles.line, { backgroundColor: colors.pin }, lineStyle]} />
      <Animated.View style={[styles.halo, { backgroundColor: colors.pin }, haloStyle]} />
      <Animated.View style={[styles.dot, { backgroundColor: colors.pin, shadowColor: colors.pin }, dotStyle]} />
      <Animated.View
        accessible
        accessibilityLabel={label}
        onLayout={(e) => {
          pw.value = e.nativeEvent.layout.width;
        }}
        style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.glassBorder }, pillStyle]}
      >
        <Text style={[font.caption, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { position: 'absolute', top: 0, left: 0, height: 1.5, transformOrigin: 'left center' },
  halo: { position: 'absolute', top: 0, left: 0, width: 36, height: 36, borderRadius: 18 },
  dot: { position: 'absolute', top: 0, left: 0, width: 16, height: 16, borderRadius: 8, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  pill: { position: 'absolute', top: 0, left: 0, height: PILL_H, paddingHorizontal: 16, borderRadius: PILL_H / 2, borderWidth: 1, justifyContent: 'center' },
});
