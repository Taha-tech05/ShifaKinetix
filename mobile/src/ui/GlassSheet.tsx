import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ScrollView } from 'react-native';
import { useBlurAllowed } from './blur';
import { useTheme } from './ThemeProvider';
import { corner } from './theme';

/** Snap points of the chat sheet: peek, half, full. */
export const SNAPS = ['18%', '45%', '82%'] as const;
export type SnapIndex = 0 | 1 | 2;

export interface GlassSheetHandle {
  /** Move the sheet from code (automation). The change is not reported as the user's. */
  snapTo: (index: SnapIndex) => void;
  scrollToEnd: () => void;
}

interface Props {
  index: SnapIndex;
  /** Called when the sheet settles on a snap point. `byUser` is false for moves made through snapTo. */
  onSettle?: (index: SnapIndex, byUser: boolean) => void;
  /** The user touched the handle or scrolled the content: automation must stop for this step. */
  onUserInteract?: () => void;
  reduceMotion?: boolean;
  /** Red-flag state: red accent on the border. Calm, no animation. */
  alert?: boolean;
  /** Pinned at the top of the sheet (drag handle sits above it). */
  header?: React.ReactNode;
  children: React.ReactNode;
  /** Scroll to the newest message when the content grows. */
  autoScroll?: boolean;
  /** Reported while the sheet moves, so the 3D camera can re-frame above it. */
  onTopChange?: (fractionOfScreenCovered: number) => void;
}

/** Bottom glass chat sheet: drag handle, three snap points, scrollable content. The one blurred surface over the 3D view. */
export const GlassSheet = forwardRef<GlassSheetHandle, Props>(function GlassSheet(
  { index, onSettle, onUserInteract, reduceMotion = false, alert = false, header, children, autoScroll = true },
  ref,
) {
  const { colors } = useTheme();
  const blurOk = useBlurAllowed();
  const sheet = useRef<BottomSheet>(null);
  const scroll = useRef<ScrollView>(null);
  const programmatic = useRef(false);
  const snapPoints = useMemo(() => [...SNAPS], []);

  useImperativeHandle(ref, () => ({
    snapTo: (i) => {
      programmatic.current = true;
      sheet.current?.snapToIndex(i, reduceMotion ? { duration: 0 } : undefined);
    },
    scrollToEnd: () => scroll.current?.scrollToEnd({ animated: !reduceMotion }),
  }));

  const Background = useCallback(
    ({ style }: BottomSheetBackgroundProps) => (
      <View style={[style, styles.bg, { backgroundColor: blurOk ? colors.glassFill : colors.surface, borderColor: alert ? colors.danger : colors.glassBorder }]}>
        {blurOk ? <BlurView intensity={50} tint={colors.blurTint} style={StyleSheet.absoluteFill} /> : null}
      </View>
    ),
    [blurOk, colors, alert],
  );

  const Handle = useCallback(
    () => (
      <View style={styles.handleZone} onTouchStart={onUserInteract} accessibilityLabel="Drag to resize" accessibilityRole="adjustable">
        <View style={[styles.handle, { backgroundColor: colors.lineStrong }]} />
      </View>
    ),
    [colors, onUserInteract],
  );

  return (
    <BottomSheet
      ref={sheet}
      index={index}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      animateOnMount={!reduceMotion}
      backgroundComponent={Background}
      handleComponent={Handle}
      onChange={(i) => {
        const byUser = !programmatic.current;
        programmatic.current = false;
        onSettle?.(i as SnapIndex, byUser);
      }}
    >
      {header ? <View style={styles.header}>{header}</View> : null}
      <BottomSheetScrollView
        ref={scroll as never}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={onUserInteract}
        onContentSizeChange={() => autoScroll && scroll.current?.scrollToEnd({ animated: !reduceMotion })}
      >
        {children}
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  bg: { borderTopStartRadius: corner.sheet, borderTopEndRadius: corner.sheet, borderWidth: 1, overflow: 'hidden' },
  handleZone: { height: 28, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 44, height: 5, borderRadius: 3 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
});
