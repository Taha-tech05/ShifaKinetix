import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from './ThemeProvider';
import { corner } from './theme';

/**
 * Snap heights of the chat sheet, as a fraction of the screen: "compressed" leaves the body clearly visible above, "peek" is only used
 * for movement steps, "expanded" goes up to just below the top bar (the body is covered). SNAPS is the list of fractions that are fixed.
 */
export const SNAPS = { peek: 0.18, compressed: 0.35 } as const;
export type SnapName = 'peek' | 'compressed' | 'expanded';

export interface GlassSheetHandle {
  /** Move the sheet from code (automation). The change is not reported as the user's. */
  snapTo: (snap: SnapName) => void;
}

interface Props {
  /** Height of the area the sheet may use (the whole screen) and the space the top bar keeps above the expanded sheet. */
  screenHeight: number;
  topInset: number;
  /** The snap to start on. */
  initial: SnapName;
  /** Peek is only allowed for movement steps. */
  allowPeek?: boolean;
  /** No handle, no dragging: the sheet is simply as tall as it may be (the red-flag questions and the red-flag state). */
  fullScreen?: boolean;
  /** Called when the sheet settles on a snap. `byUser` is false for moves made through snapTo. */
  onSettle?: (snap: SnapName, byUser: boolean) => void;
  /** The user touched the handle: automation stops for this step. */
  onUserInteract?: () => void;
  reduceMotion?: boolean;
  /** Red-flag state: a red border. Nothing animates. */
  alert?: boolean;
  /** Pinned under the handle. */
  header?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The chat sheet. It is always anchored to the bottom edge: only its HEIGHT changes (drag the handle or tap it), so it can never float,
 * move sideways or leave a gap. It is nearly solid, because it no longer has to show the body through it.
 */
export const GlassSheet = forwardRef<GlassSheetHandle, Props>(function GlassSheet(
  { screenHeight, topInset, initial, allowPeek = false, fullScreen = false, onSettle, onUserInteract, reduceMotion = false, alert = false, header, children },
  ref,
) {
  const { colors } = useTheme();
  const expanded = Math.max(0, screenHeight - topInset);
  const heights = useMemo(
    () => ({ peek: Math.round(screenHeight * SNAPS.peek), compressed: Math.round(screenHeight * SNAPS.compressed), expanded }),
    [screenHeight, expanded],
  );
  const min = allowPeek ? heights.peek : heights.compressed;
  const startHeight = fullScreen ? expanded : heights[initial === 'peek' && !allowPeek ? 'compressed' : initial];
  const h = useSharedValue(startHeight);
  const dragStart = useSharedValue(startHeight);
  const duration = reduceMotion ? 0 : 240;
  // entering or leaving the full-screen (no body) state, or a new screen size: follow at once
  useEffect(() => {
    if (fullScreen) h.value = expanded; // eslint-disable-line react-hooks/immutability
  }, [fullScreen, expanded, h]);

  const goTo = useCallback(
    (snap: SnapName, byUser: boolean) => {
      const target = fullScreen ? expanded : heights[snap === 'peek' && !allowPeek ? 'compressed' : snap];
      // eslint-disable-next-line react-hooks/immutability -- shared value: animated on the UI thread
      h.value = withTiming(target, { duration }, (done) => {
        if (done && onSettle) runOnJS(onSettle)(snap === 'peek' && !allowPeek ? 'compressed' : snap, byUser);
      });
    },
    [allowPeek, duration, expanded, fullScreen, h, heights, onSettle],
  );
  useImperativeHandle(ref, () => ({ snapTo: (snap) => goTo(snap, false) }), [goTo]);

  const nearest = useCallback(
    (value: number, velocity: number): SnapName => {
      // a quick flick goes to the next snap in that direction, a slow release to the nearest one
      const list: [SnapName, number][] = (allowPeek ? [['peek', heights.peek]] : []).concat([['compressed', heights.compressed], ['expanded', heights.expanded]] as [SnapName, number][]) as [SnapName, number][];
      const projected = value - velocity * 0.12;
      let best = list[0];
      for (const item of list) if (Math.abs(item[1] - projected) < Math.abs(best[1] - projected)) best = item;
      return best[0];
    },
    [allowPeek, heights],
  );
  const toggle = useCallback(() => {
    onUserInteract?.();
    goTo(Math.abs(h.value - heights.expanded) < 4 ? 'compressed' : 'expanded', true);
  }, [goTo, h, heights.expanded, onUserInteract]);
  const release = useCallback((value: number, velocity: number) => goTo(nearest(value, velocity), true), [goTo, nearest]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!fullScreen)
        .onBegin(() => {
          dragStart.value = h.value;
          if (onUserInteract) runOnJS(onUserInteract)();
        })
        .onUpdate((e) => {
          // only the height changes, and never beyond the lowest or the highest snap (no overshoot)
          h.value = Math.min(heights.expanded, Math.max(min, dragStart.value - e.translationY));
        })
        .onEnd((e) => {
          runOnJS(release)(h.value, -e.velocityY);
        }),
    [dragStart, fullScreen, h, heights.expanded, min, onUserInteract, release],
  );
  const tap = useMemo(() => Gesture.Tap().enabled(!fullScreen).onEnd(() => runOnJS(toggle)()), [fullScreen, toggle]);
  const gesture = useMemo(() => Gesture.Exclusive(pan, tap), [pan, tap]);

  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <Animated.View style={[styles.sheet, { backgroundColor: colors.sheet, borderColor: alert ? colors.danger : colors.glassBorder }, style]}>
      {fullScreen ? (
        <View style={styles.noHandle} />
      ) : (
        <GestureDetector gesture={gesture}>
          <View style={styles.handleZone} accessible accessibilityRole="adjustable" accessibilityLabel="Resize the panel">
            <View style={[styles.handle, { backgroundColor: colors.lineStrong }]} />
          </View>
        </GestureDetector>
      )}
      {header ? <View style={styles.header}>{header}</View> : null}
      <View style={styles.body}>{children}</View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  sheet: { position: 'absolute', start: 0, end: 0, bottom: 0, borderTopStartRadius: corner.sheet, borderTopEndRadius: corner.sheet, borderWidth: 1, borderBottomWidth: 0, overflow: 'hidden' },
  handleZone: { height: 36, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 48, height: 5, borderRadius: 3 },
  noHandle: { height: 12 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  body: { flex: 1 },
});
