import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { BodyViewer } from '../components/BodyViewer';
import { MovementStage } from '../components/movement/MovementStage';
import type { MovementStageHandle } from '../components/movement/MovementStage';
import { SosButton } from '../components/SosButton';
import { highlightNamesFor } from '../regions/regionMap';
import { regionLabel, selectionKey } from '../regions/shoulder';
import type { BodyLayer } from '../regions/types';
import { useChrome } from '../store/chrome';
import { useSession } from '../store/session';
import { useT } from '../store/settings';
import { Callout } from './Callout';
import { PairView, useChatPairs } from './ChatHistory';
import type { Pair } from './ChatHistory';
import { TypingDots, useTypingDelay } from './chat';
import { Chip } from './Chip';
import { FloatingControl } from './FloatingControl';
import { GlassCard } from './GlassCard';
import { GlassSheet } from './GlassSheet';
import type { GlassSheetHandle, SnapName } from './GlassSheet';
import { LanguageMenu } from './LanguageMenu';
import { Legend } from './Legend';
import { useScene } from './scene';
import { useTheme } from './ThemeProvider';
import { MIN_TOUCH, font, studio } from './theme';

/** Routes that accept taps on the body. */
const TAPPABLE = new Set(['body', 'confirm']);
/** Routes that show the 3D body: the area tap, the narrowing and movement steps, the result. */
const BODY_ROUTES = new Set(['intro', 'fork', 'body', 'confirm', 'movement', 'result']);
/** Routes that use the movement stage (the rigged body with highlights); the others use the picking body. */
const MOVEMENT_STAGE_ROUTES = new Set(['movement', 'result']);
/** Height of the top bar (back, progress, language, SOS). The expanded sheet stops just below it. */
const TOP_BAR = 72;

/** The phone's "reduce motion" setting, kept up to date. */
function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => undefined);
    const sub = (AccessibilityInfo as unknown as { addEventListener?: (n: string, f: (v: boolean) => void) => { remove: () => void } }).addEventListener?.('reduceMotionChanged', setReduce);
    return () => sub?.remove();
  }, []);
  return reduce;
}

type Row = { key: string; pair: Pair } | { key: 'current' } | { key: 'typing' };

/**
 * The one persistent chat list. Answered questions come from the saved answers (read-only), the question being asked is the last row,
 * and a new question is APPENDED (after the typing dots): nothing above it is rebuilt. Near the bottom the list follows the new
 * question; if the patient has scrolled up it stays exactly where it is and a small "Current question" pill offers the way down.
 */
function ChatList({ afterConfirm, reduceMotion, bottomPad, onScrollUser }: { afterConfirm: boolean; reduceMotion: boolean; bottomPad: number; onScrollUser: () => void }) {
  const { colors } = useTheme();
  const t = useT();
  const sheet = useScene((s) => s.sheet);
  const [last, setLast] = useState<typeof sheet>(null);
  const typing = useTypingDelay(sheet?.contentKey ?? '', reduceMotion);
  if (sheet && !typing && last !== sheet) setLast(sheet);
  // while the dots show, the previous message stays where it was
  const shown = typing ? last : sheet;
  const pairs = useChatPairs(sheet?.ownIds ?? [], afterConfirm);
  const rows = useMemo<Row[]>(() => [...pairs.map((p) => ({ key: `p-${p.key}`, pair: p })), { key: 'current' as const }, ...(typing ? [{ key: 'typing' as const }] : [])], [pairs, typing]);

  const list = useRef<FlatList<Row>>(null);
  const atBottom = useRef(true);
  const [pill, setPill] = useState(false);
  const toEnd = useCallback(() => list.current?.scrollToEnd({ animated: !reduceMotion }), [reduceMotion]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    atBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
    if (atBottom.current) setPill(false);
  };
  const onSize = () => {
    if (atBottom.current) toEnd();
    else setPill(true);
  };

  return (
    <View style={styles.fill}>
      <FlatList
        ref={list}
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={({ item }) =>
          'pair' in item ? (
            <PairView pair={item.pair} />
          ) : item.key === 'typing' ? (
            <TypingDots label={t('scene.typing')} still={reduceMotion} />
          ) : (
            <View pointerEvents={typing ? 'none' : 'auto'} style={styles.current}>
              {shown?.node}
            </View>
          )
        }
        ItemSeparatorComponent={Gap}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        onScroll={onScroll}
        scrollEventThrottle={64}
        onContentSizeChange={onSize}
        onScrollBeginDrag={onScrollUser}
        showsVerticalScrollIndicator={false}
      />
      {pill ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('scene.currentQuestion')}
          onPress={() => {
            atBottom.current = true;
            setPill(false);
            toEnd();
          }}
          style={[styles.pill, { backgroundColor: colors.accentFill }]}
        >
          <Text style={[font.caption, { color: colors.onAccent, fontWeight: '800' }]}>{t('scene.currentQuestion')}</Text>
          <Ionicons name="arrow-down" size={16} color={colors.onAccent} />
        </Pressable>
      ) : null}
    </View>
  );
}

const Gap = () => <View style={styles.gap} />;

/**
 * The persistent layers of the symptom flow, mounted once by report/_layout: the 3D body (full screen, original studio background,
 * no box), floating controls, the tap callout and the one chat sheet. Where the 3D body is not shown (the red-flag questions and the
 * red-flag state) the chat takes the whole screen and the 3D canvas is not mounted at all.
 */
export function SceneHost({ leaf }: { leaf: string }) {
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const bodyVisible = BODY_ROUTES.has(leaf);
  const movementStage = MOVEMENT_STAGE_ROUTES.has(leaf);
  const selection = useSession((s) => s.selection);
  const mode = useSession((s) => s.mode);
  const setSelection = useSession((s) => s.setSelection);
  const scene = useScene(useShallow((s) => ({ onBack: s.onBack, progress: s.progress, mode: s.mode, stepKey: s.stepKey, instruction: s.instruction, stage: s.stage, demoDismissed: s.demoDismissed })));
  const [layer, setLayer] = useState<BodyLayer>('muscle');
  const [snap, setSnap] = useState<SnapName>('compressed');
  const [status, setStatus] = useState<'loading' | 'ready' | 'plain'>('loading');
  const [message, setMessage] = useState<'none' | 'miss' | 'outOfScope'>('none');
  const [legend, setLegend] = useState(false);
  const sheetRef = useRef<GlassSheetHandle>(null);
  const stageRef = useRef<MovementStageHandle>(null);

  // the question screens draw no app-wide demo strip: this screen has its own dismissible banner
  useEffect(() => {
    useChrome.getState().setCompact(true);
    return () => useChrome.getState().setCompact(false);
  }, []);

  // ---- tap callout: screen position of the tapped point, written to shared values (no React render per frame) ----
  const px = useSharedValue(0);
  const py = useSharedValue(0);
  const facing = useSharedValue(0);
  const onProject = useCallback(
    (p: { x: number; y: number; facing: number } | null) => {
      /* eslint-disable react-hooks/immutability -- shared values are written from the 3D frame loop on purpose: no React render per frame */
      if (!p) {
        facing.value = 0;
        return;
      }
      px.value = p.x;
      py.value = p.y;
      facing.value = p.facing;
      /* eslint-enable react-hooks/immutability */
    },
    [px, py, facing],
  );
  const label = selection ? regionLabel(selection.regionId, selection.subRegionId) : null;
  const highlightNames = useMemo(() => (mode ? highlightNamesFor(selection, mode) : []), [mode, selection]);

  // ---- sheet automation: manual control always wins for the current step ----
  const userOverride = useRef(false);
  const dragging = useRef(false);
  const played = useRef(false);
  const mark = useCallback(() => {
    userOverride.current = true;
    dragging.current = true;
  }, []);
  const move = useCallback((s: SnapName) => {
    if (userOverride.current || dragging.current) return;
    sheetRef.current?.snapTo(s);
  }, []);
  useEffect(() => {
    // a new step: automation is on again. Moving steps collapse to peek, everything else sits on the compressed snap.
    userOverride.current = false;
    dragging.current = false;
    played.current = false;
    if (!bodyVisible) return;
    move(scene.mode === 'moving' ? 'peek' : 'compressed');
  }, [scene.stepKey, scene.mode, bodyVisible, move]);
  const onPlayedOnce = useCallback(() => {
    if (played.current) return;
    played.current = true;
    useScene.getState().markPlayed();
    move('compressed'); // after the animation: the compressed snap, never the full sheet
  }, [move]);
  const replay = () => {
    played.current = false;
    userOverride.current = false;
    stageRef.current?.replay();
    sheetRef.current?.snapTo('peek');
  };

  const redFlag = scene.mode === 'redflag';
  const stage = scene.stage;
  const moving = scene.mode === 'moving';
  const fullChat = !bodyVisible;
  const screenH = box.h;
  const compressedPx = Math.round(screenH * 0.35);
  const peekPx = Math.round(screenH * 0.18);
  // the body is framed in the part above the sheet (the compressed height at most: the expanded sheet simply covers it)
  const stageBottom = snap === 'peek' && moving ? peekPx : compressedPx;
  const showCallout = bodyVisible && !movementStage && !!label && !!selection && TAPPABLE.has(leaf) && status === 'ready';
  const changeLayer = (l: BodyLayer) => {
    setLayer(l);
    stageRef.current?.setLayer(l);
    if (leaf === 'body') setSelection(null); // a spot chosen in one layer is cleared when the layer changes
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
      {/* the body's own background, as in the original app; with no body the chat sits on the dark reference surface */}
      {bodyVisible ? (
        <LinearGradient colors={[...studio]} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      ) : (
        <LinearGradient colors={[...colors.gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      )}

      {bodyVisible && screenH > 0 ? (
        <View style={[styles.stage, { top: TOP_BAR, bottom: stageBottom }]}>
          {movementStage && stage ? (
            <MovementStage
              ref={stageRef}
              bare
              movement={stage.movement}
              side={stage.side}
              paused={stage.paused}
              highlightIds={stage.highlightIds}
              autoFocus={stage.autoFocus}
              labelIds={stage.labelIds}
              approx={stage.approx}
              cameraPreset={stage.cameraPreset}
              onPlayedOnce={onPlayedOnce}
              onLayerChange={setLayer}
              style={styles.fill}
            />
          ) : (
            <BodyViewer
              bare
              layer={layer}
              readOnly={!TAPPABLE.has(leaf)}
              highlightedIds={selection ? [selectionKey(selection.regionId, selection.subRegionId)] : []}
              highlightNames={highlightNames}
              anchor={selection?.point ?? null}
              onProject={onProject}
              onSelect={setSelection}
              onMessage={setMessage}
              onStatus={setStatus}
            />
          )}
        </View>
      ) : null}

      {showCallout && label ? <Callout label={label} x={px} y={py} facing={facing} width={box.w} height={screenH} topInset={TOP_BAR + 8} bottomInset={stageBottom + 8} reduceMotion={reduceMotion} /> : null}

      {/* floating controls */}
      <View style={styles.top} pointerEvents="box-none">
        <View style={styles.row}>
          {scene.onBack ? <FloatingControl icon={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'} label={t('common.back')} onPress={scene.onBack} /> : null}
          <View style={[styles.progress, { backgroundColor: colors.controlFill, borderColor: colors.glassBorder }]} accessible accessibilityRole="progressbar" accessibilityLabel={scene.progress?.label ?? t('scene.phasePoint')}>
            <Text style={[font.caption, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
              {scene.progress?.label ?? t('scene.phasePoint')}
            </Text>
            <View style={[styles.line, { backgroundColor: colors.track }]}>
              <View style={[styles.lineFill, { backgroundColor: colors.pin, width: `${Math.round(Math.min(1, Math.max(0.04, scene.progress?.value ?? 0.1)) * 100)}%` }]} />
            </View>
          </View>
          <LanguageMenu />
          <SosButton />
        </View>

        {!scene.demoDismissed ? (
          <GlassCard padding={12} radius={20} style={{ backgroundColor: colors.cautionTint }}>
            <View style={styles.demoRow}>
              <Ionicons name="warning-outline" size={20} color={colors.caution} />
              <Text style={[font.caption, { color: colors.caution, fontWeight: '700', flex: 1 }]} accessibilityRole="alert">
                {t('demoBanner')}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('scene.dismiss')} onPress={() => useScene.getState().dismissDemo()} style={styles.dismiss}>
                <Text style={[font.caption, { color: colors.caution, fontWeight: '800' }]}>{t('scene.dismiss')}</Text>
              </Pressable>
            </View>
          </GlassCard>
        ) : null}

        <View style={styles.row}>
          {bodyVisible ? (
            <View style={[styles.layers, { borderColor: colors.glassBorder, backgroundColor: colors.controlFill }]} accessibilityLabel={t('layers.title')}>
              <Chip label={t('layers.muscle')} selected={layer === 'muscle'} onPress={() => changeLayer('muscle')} />
              <Chip label={t('layers.bone')} selected={layer === 'bone'} onPress={() => changeLayer('bone')} />
            </View>
          ) : null}
          {label ? <Chip tone="region" icon="locate" label={label} /> : null}
        </View>
        {bodyVisible && !movementStage && message !== 'none' ? (
          <View style={[styles.note, { backgroundColor: colors.controlFill }]}>
            <Text style={[font.caption, { color: colors.text }]}>{message === 'outOfScope' ? t('body.outOfScope') : t('body.tapShoulder')}</Text>
          </View>
        ) : null}
      </View>

      {/* movement controls, bottom right of the body, as in the original; the instruction chip (with the safety line) stays while the sheet is collapsed */}
      {bodyVisible && movementStage && stage ? (
        <View style={[styles.actions, { bottom: stageBottom + 12 }]} pointerEvents="box-none">
          {!stage.paused ? <FloatingControl icon="refresh" label={t('movement.replay')} onPress={replay} /> : null}
          {stage.autoFocus && stage.highlightIds.length > 0 ? <FloatingControl icon="scan" label={t('movement.refocus')} onPress={() => stageRef.current?.refocus()} /> : null}
          <FloatingControl icon="locate" label={t('movement.resetView')} onPress={() => stageRef.current?.resetView()} />
        </View>
      ) : null}
      {bodyVisible && moving && scene.instruction ? (
        <View style={[styles.chipWrap, { bottom: stageBottom + 12 }]} pointerEvents="box-none">
          <GlassCard padding={14} radius={24} style={{ backgroundColor: colors.sheet }}>
            <Text style={[font.body, { color: colors.text, fontWeight: '800' }]} accessibilityRole="header">
              {scene.instruction}
            </Text>
            <View style={styles.demoRow}>
              <Ionicons name="warning-outline" size={18} color={colors.caution} />
              <Text style={[font.caption, { color: colors.caution, flex: 1 }]} accessibilityRole="alert">
                {t('moveSafely')}
              </Text>
            </View>
          </GlassCard>
        </View>
      ) : null}

      {screenH > 0 ? (
        <GlassSheet
          ref={sheetRef}
          screenHeight={screenH}
          topInset={TOP_BAR}
          initial="compressed"
          allowPeek={moving}
          fullScreen={fullChat}
          alert={redFlag}
          reduceMotion={reduceMotion}
          onUserInteract={mark}
          onSettle={(s, byUser) => {
            setSnap(s);
            if (byUser) userOverride.current = true;
            dragging.current = false;
          }}
          header={
            <View style={styles.sheetHeader}>
              <FloatingControl icon="information-circle-outline" label={t('scene.legend')} onPress={() => setLegend(true)} />
              <Pressable accessibilityRole="button" accessibilityLabel={t('scene.talkDoctor')} onPress={() => router.push('/report/doctor')} style={[styles.doctorPill, { borderColor: colors.lineStrong }]}>
                <Text style={[font.caption, { color: colors.accentText, fontWeight: '800' }]}>{t('scene.talkDoctor')}</Text>
              </Pressable>
            </View>
          }
        >
          <ChatList afterConfirm={!TAPPABLE.has(leaf) && leaf !== 'intro' && leaf !== 'fork'} reduceMotion={reduceMotion} bottomPad={insets.bottom + 24} onScrollUser={mark} />
        </GlassSheet>
      ) : null}
      <Legend visible={legend} onClose={() => setLegend(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  gap: { height: 10 },
  current: { gap: 10 },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  stage: { position: 'absolute', start: 0, end: 0 },
  top: { position: 'absolute', top: 8, start: 12, end: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  progress: { flex: 1, minHeight: MIN_TOUCH, gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, borderWidth: 1, justifyContent: 'center' },
  line: { height: 3, borderRadius: 2, overflow: 'hidden' },
  lineFill: { height: 3, borderRadius: 2 },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dismiss: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  layers: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999, borderWidth: 1 },
  note: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  actions: { position: 'absolute', end: 12, gap: 8 },
  chipWrap: { position: 'absolute', start: 16, end: 72 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doctorPill: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5 },
  pill: { position: 'absolute', alignSelf: 'center', bottom: 16, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, borderRadius: 22 },
});
