import { BlurView } from 'expo-blur';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useBlurGuard } from './blur';
import { useTheme } from './ThemeProvider';
import { corner } from './theme';

/**
 * Sizes of the chat sheet. The sheet can be left at ANY height between "min" and "expanded": drag the handle and it stays where it is let go.
 * Named heights, used by the automation and by a tap on the handle:
 *  - min: only the drag handle (the model alone is visible)
 *  - peek: low, used for movement steps (a fraction of the screen)
 *  - compressed ("fit"): just tall enough to show the current question and its answer options at one glance
 *  - expanded: up to just below the top controls (the body is covered)
 * SNAPS holds the fixed sizes.
 */
export const SNAPS = { min: 40, peek: 0.18, fitMin: 0.4, fitMax: 0.5 } as const;
export type SnapName = 'min' | 'peek' | 'compressed' | 'expanded' | 'free';

export interface GlassSheetHandle {
  /** Move the sheet from code (automation). The change is not reported as the user's. */
  snapTo: (snap: Exclude<SnapName, 'free'>) => void;
}

interface Props {
  /** Height of the area the sheet may use (the whole screen) and the space the top controls keep above the expanded sheet. */
  screenHeight: number;
  topInset: number;
  /** Height of the current question with its answer options, so the "fit" height can show it at one glance. */
  fitContent?: number;
  /** Peek is only allowed for movement steps. The handle-only "min" is always allowed. */
  allowPeek?: boolean;
  /** No handle, no dragging: the sheet is simply as tall as it may be (the red-flag questions and the red-flag state). */
  fullScreen?: boolean;
  /** Called when the sheet settles. `byUser` is false for moves made through snapTo. `height` is in px. */
  onSettle?: (snap: SnapName, byUser: boolean, height: number) => void;
  /** Called when the "fit" height changes (a new question): the automation can move the sheet to it. */
  onFitChange?: (fit: number) => void;
  /** The user touched the handle: automation stops for this step. */
  onUserInteract?: () => void;
  reduceMotion?: boolean;
  /** The view that holds what is behind the sheet (the body). On Android the blur needs it; without it the sheet is nearly solid. */
  blurTarget?: RefObject<View | null>;
  /** Red-flag state: a red border. Nothing animates. */
  alert?: boolean;
  /** Pinned under the handle. */
  header?: React.ReactNode;
  children: React.ReactNode;
}

const HANDLE = 36;

/**
 * The chat sheet. It is always anchored to the bottom edge: only its HEIGHT changes, so it can never float, move sideways or leave a gap.
 * It is frosted glass over the body: translucent, blurred, and still clear enough to read.
 */
export const GlassSheet = forwardRef<GlassSheetHandle, Props>(function GlassSheet(
  { screenHeight, topInset, fitContent = 0, allowPeek = false, fullScreen = false, onSettle, onFitChange, onUserInteract, reduceMotion = false, blurTarget, alert = false, header, children },
  ref,
) {
  const { colors } = useTheme();
  // frosted glass over the body: iOS always, Android 12+ through the blur target. If the frame rate drops, blur is switched off.
  const forceSolid = useBlurGuard((s) => s.forceSolid);
  const canBlur = !forceSolid && (Platform.OS === 'ios' || (Platform.OS === 'android' && Number(Platform.Version) >= 31 && !!blurTarget));
  const [headerH, setHeaderH] = useState(0);
  const expanded = Math.max(0, screenHeight - topInset);
  // "fit": the handle, the header and the current question with its options, never lower than 40% or higher than 50% of the screen
  const fit = useMemo(() => {
    const want = HANDLE + headerH + fitContent + 24;
    const lo = Math.round(screenHeight * SNAPS.fitMin);
    const hi = Math.round(screenHeight * SNAPS.fitMax);
    return fitContent > 0 ? Math.round(Math.min(hi, Math.max(lo, want))) : lo;
  }, [screenHeight, headerH, fitContent]);
  const heights = useMemo(() => ({ min: SNAPS.min, peek: Math.round(screenHeight * SNAPS.peek), compressed: fit, expanded }), [screenHeight, fit, expanded]);
  const h = useSharedValue(fullScreen ? expanded : fit);
  const dragStart = useSharedValue(0);
  const duration = reduceMotion ? 0 : 240;

  useEffect(() => {
    onFitChange?.(fit);
  }, [fit]); // eslint-disable-line react-hooks/exhaustive-deps
  // entering or leaving the full-screen (no body) state, or a new screen size: follow at once
  useEffect(() => {
    if (fullScreen) h.value = expanded; // eslint-disable-line react-hooks/immutability
  }, [fullScreen, expanded, h]);

  const goTo = useCallback(
    (snap: Exclude<SnapName, 'free'>, byUser: boolean) => {
      const name = snap === 'peek' && !allowPeek ? 'compressed' : snap;
      const target = fullScreen ? expanded : heights[name];
      // eslint-disable-next-line react-hooks/immutability -- shared value: animated on the UI thread
      h.value = withTiming(target, { duration }, (done) => {
        if (done && onSettle) runOnJS(onSettle)(name, byUser, target);
      });
    },
    [allowPeek, duration, expanded, fullScreen, h, heights, onSettle],
  );
  useImperativeHandle(ref, () => ({ snapTo: (snap) => goTo(snap, false) }), [goTo]);

  const toggle = useCallback(() => {
    onUserInteract?.();
    // a tap opens a collapsed sheet to the fit height, and collapses an open one to the handle
    goTo(h.value <= heights.min + 8 ? 'compressed' : 'min', true);
  }, [goTo, h, heights.min, onUserInteract]);

  /** Let go at any height. Close to the lowest or the highest, or after a hard flick, the sheet goes the rest of the way. */
  const release = useCallback(
    (value: number, velocity: number) => {
      if (velocity > 1400) return goTo(value < heights.compressed - 8 ? 'compressed' : 'expanded', true);
      if (velocity < -1400) return goTo(value > heights.compressed + 8 ? 'compressed' : 'min', true);
      if (value < heights.min + 56) return goTo('min', true);
      if (value > heights.expanded - 56) return goTo('expanded', true);
      if (onSettle) onSettle('free', true, value);
    },
    [goTo, heights, onSettle],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!fullScreen)
        .onBegin(() => {
          dragStart.value = h.value;
          if (onUserInteract) runOnJS(onUserInteract)();
        })
        .onUpdate((e) => {
          // only the height changes, and never beyond the lowest or the highest height (no overshoot)
          h.value = Math.min(heights.expanded, Math.max(heights.min, dragStart.value - e.translationY));
        })
        .onEnd((e) => {
          runOnJS(release)(h.value, -e.velocityY);
        }),
    [dragStart, fullScreen, h, heights.expanded, heights.min, onUserInteract, release],
  );
  const tap = useMemo(() => Gesture.Tap().enabled(!fullScreen).onEnd(() => runOnJS(toggle)()), [fullScreen, toggle]);
  const gesture = useMemo(() => Gesture.Exclusive(pan, tap), [pan, tap]);

  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <Animated.View style={[styles.sheet, { backgroundColor: canBlur ? colors.sheet : colors.sheetFallback, borderColor: alert ? colors.danger : colors.glassBorder }, style]}>
      {canBlur ? <BlurView intensity={55} tint={colors.blurTint} blurTarget={blurTarget} blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} /> : null}
      {fullScreen ? (
        <View style={styles.noHandle} />
      ) : (
        <GestureDetector gesture={gesture}>
          <View style={styles.handleZone} accessible accessibilityRole="adjustable" accessibilityLabel="Resize the panel">
            <View style={[styles.handle, { backgroundColor: colors.lineStrong }]} />
          </View>
        </GestureDetector>
      )}
      {header ? (
        <View style={styles.header} onLayout={(e: LayoutChangeEvent) => setHeaderH(Math.round(e.nativeEvent.layout.height))}>
          {header}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  sheet: { position: 'absolute', start: 0, end: 0, bottom: 0, borderTopStartRadius: corner.sheet, borderTopEndRadius: corner.sheet, borderWidth: 1, borderBottomWidth: 0, overflow: 'hidden' },
  handleZone: { height: HANDLE, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 48, height: 5, borderRadius: 3 },
  noHandle: { height: 12 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  body: { flex: 1 },
});
