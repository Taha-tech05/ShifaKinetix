import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, I18nManager, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSharedValue } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useFpsGuard } from './blur';
import { Callout } from './Callout';
import { ChatHistory } from './ChatHistory';
import { TypingDots, useTypingDelay } from './chat';
import { Chip } from './Chip';
import { FloatingControl } from './FloatingControl';
import { GlassCard } from './GlassCard';
import { GlassSheet } from './GlassSheet';
import type { GlassSheetHandle, SnapIndex } from './GlassSheet';
import { LanguageMenu } from './LanguageMenu';
import { useScene } from './scene';
import { useTheme } from './ThemeProvider';
import { font } from './theme';

const FRACTIONS = [0.18, 0.45, 0.82] as const;
/** Routes that show the body for picking (the body stays turnable; only body and confirm accept taps). */
const TAPPABLE = new Set(['body', 'confirm']);
const TOP_INSET = 150;

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

/** The content of the shared sheet: the chat so far, then what the current route handed over (after the typing dots). */
function SheetOutlet({ afterConfirm, reduceMotion }: { afterConfirm: boolean; reduceMotion: boolean }) {
  const t = useT();
  const sheet = useScene((s) => s.sheet);
  const [last, setLast] = useState<typeof sheet>(null);
  const typing = useTypingDelay(sheet?.contentKey ?? '', reduceMotion);
  if (sheet && !typing && last !== sheet) setLast(sheet);
  // while the dots show, the previous message stays above them
  const shown = typing ? last : sheet;
  return (
    <>
      <ChatHistory exclude={sheet?.ownIds ?? []} afterConfirm={afterConfirm} />
      <View pointerEvents={typing ? 'none' : 'auto'} style={styles.gap}>
        {shown?.node}
      </View>
      {typing ? <TypingDots label={t('scene.typing')} still={reduceMotion} /> : null}
    </>
  );
}

/**
 * The persistent layers of the symptom flow: the 3D body (always dark), floating controls, the tap callout and the one glass
 * chat sheet. It is mounted once by report/_layout, so the body and the sheet stay put while the question routes change.
 */
export function SceneHost({ leaf }: { leaf: string }) {
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  useFpsGuard(true);

  const phase = leaf === 'movement' ? 'movement' : 'pick';
  const selection = useSession((s) => s.selection);
  const mode = useSession((s) => s.mode);
  const setSelection = useSession((s) => s.setSelection);
  const scene = useScene(useShallow((s) => ({ onBack: s.onBack, progress: s.progress, mode: s.mode, stepKey: s.stepKey, instruction: s.instruction, stage: s.stage, demoDismissed: s.demoDismissed })));
  const [layer, setLayer] = useState<BodyLayer>('muscle');
  const [snap, setSnap] = useState<SnapIndex>(1);
  const [status, setStatus] = useState<'loading' | 'ready' | 'plain'>('loading');
  const [message, setMessage] = useState<'none' | 'miss' | 'outOfScope'>('none');
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
  const move = useCallback((i: SnapIndex) => {
    if (userOverride.current || dragging.current) return;
    sheetRef.current?.snapTo(i);
  }, []);
  useEffect(() => {
    // a new step: automation is on again
    userOverride.current = false;
    dragging.current = false;
    played.current = false;
    if (scene.mode === 'moving') move(0);
    else move(1);
  }, [scene.stepKey, scene.mode, move]);
  const onPlayedOnce = useCallback(() => {
    if (played.current) return;
    played.current = true;
    useScene.getState().markPlayed();
    move(1);
  }, [move]);
  const replay = () => {
    played.current = false;
    userOverride.current = false;
    stageRef.current?.replay();
    sheetRef.current?.snapTo(0);
  };

  const frac = FRACTIONS[snap];
  const sheetPx = Math.round(height * frac);
  // the body is framed in the part of the screen above the sheet (at most down to the half-height line)
  const stageBottom = phase === 'movement' ? Math.round(height * Math.min(frac, FRACTIONS[1])) : 0;
  const redFlag = scene.mode === 'redflag';
  const stopped = redFlag || scene.mode === 'caution';
  const stage = scene.stage;
  const moving = scene.mode === 'moving';
  const showCallout = phase === 'pick' && !!label && !!selection && TAPPABLE.has(leaf) && status === 'ready';
  const changeLayer = (l: BodyLayer) => {
    setLayer(l);
    stageRef.current?.setLayer(l);
    if (leaf === 'body') setSelection(null); // a spot chosen in one layer is cleared when the layer changes
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* deep blue studio, lighter in the middle, with the warm glow under the figure */}
      <LinearGradient colors={['#0D2036', '#3D84AD', '#0D2036']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.glow, { bottom: Math.max(stageBottom, 0) + 12 }]} pointerEvents="none" />

      <View style={[styles.stage, { bottom: stageBottom }]}>
        {phase === 'movement' && stage ? (
          <MovementStage
            ref={stageRef}
            bare
            movement={stage.movement}
            side={stage.side}
            paused={stage.paused}
            highlightIds={stage.highlightIds}
            autoFocus={stage.autoFocus}
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

      {stopped ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,12,22,0.55)' }]} pointerEvents="none" /> : null}

      {showCallout && label ? (
        <Callout label={label} x={px} y={py} facing={facing} width={width} height={height} topInset={TOP_INSET + insets.top * 0} bottomInset={sheetPx + 8} reduceMotion={reduceMotion} />
      ) : null}

      {/* floating controls */}
      <View style={styles.top} pointerEvents="box-none">
        <View style={styles.row}>
          {scene.onBack ? <FloatingControl icon={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'} label={t('common.back')} onPress={scene.onBack} /> : null}
          <View style={styles.progress} accessible accessibilityRole="progressbar" accessibilityLabel={scene.progress?.label ?? t('scene.phasePoint')}>
            <Text style={[font.caption, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
              {scene.progress?.label ?? t('scene.phasePoint')}
            </Text>
            <View style={[styles.line, { backgroundColor: colors.track }]}>
              <View style={[styles.lineFill, { backgroundColor: colors.accent, width: `${Math.round(Math.min(1, Math.max(0.04, scene.progress?.value ?? 0.1)) * 100)}%` }]} />
            </View>
          </View>
          <LanguageMenu />
          <SosButton />
        </View>

        {!scene.demoDismissed ? (
          <GlassCard padding={12} radius={20} style={{ backgroundColor: colors.cautionTint }}>
            <View style={styles.demoRow}>
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
          <View style={[styles.layers, { borderColor: colors.glassBorder, backgroundColor: colors.glassFill }]} accessibilityLabel={t('layers.title')}>
            <Chip label={t('layers.muscle')} selected={layer === 'muscle'} onPress={() => changeLayer('muscle')} />
            <Chip label={t('layers.bone')} selected={layer === 'bone'} onPress={() => changeLayer('bone')} />
          </View>
          <View style={styles.grow} />
          {phase === 'movement' && stage ? (
            <>
              {!stage.paused ? <FloatingControl icon="refresh" label={t('movement.replay')} onPress={replay} /> : null}
              {stage.autoFocus && stage.highlightIds.length > 0 ? <FloatingControl icon="scan" label={t('movement.refocus')} onPress={() => stageRef.current?.refocus()} /> : null}
              <FloatingControl icon="locate" label={t('movement.resetView')} onPress={() => stageRef.current?.resetView()} />
            </>
          ) : null}
        </View>
        {phase === 'pick' && message !== 'none' ? (
          <Text style={[font.caption, styles.hint, { color: colors.text }]}>{message === 'outOfScope' ? t('body.outOfScope') : t('body.tapShoulder')}</Text>
        ) : null}
      </View>

      {/* the movement instruction stays on screen, with the safety line, while the sheet is collapsed */}
      {moving && scene.instruction ? (
        <View style={[styles.chipWrap, { bottom: sheetPx + 12 }]} pointerEvents="box-none">
          <GlassCard padding={14} radius={24} blur>
            <Text style={[font.body, { color: colors.text, fontWeight: '800' }]} accessibilityRole="header">
              {scene.instruction}
            </Text>
            <Text style={[font.caption, { color: colors.caution }]} accessibilityRole="alert">
              {t('moveSafely')}
            </Text>
          </GlassCard>
        </View>
      ) : null}

      <GlassSheet
        ref={sheetRef}
        index={1}
        reduceMotion={reduceMotion}
        alert={redFlag}
        onUserInteract={mark}
        onSettle={(i, byUser) => {
          setSnap(i);
          if (byUser) userOverride.current = true;
          dragging.current = false;
        }}
        header={
          <Pressable accessibilityRole="button" accessibilityLabel={t('scene.talkDoctor')} onPress={() => router.push('/report/doctor')} style={[styles.doctorPill, { borderColor: colors.glassBorder, backgroundColor: colors.accentTint }]}>
            <Text style={[font.caption, { color: colors.accentText, fontWeight: '800' }]}>{t('scene.talkDoctor')}</Text>
          </Pressable>
        }
      >
        <SheetOutlet afterConfirm={!TAPPABLE.has(leaf)} reduceMotion={reduceMotion} />
      </GlassSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  gap: { gap: 12 },
  stage: { position: 'absolute', top: 0, start: 0, end: 0 },
  glow: { position: 'absolute', alignSelf: 'center', width: 260, height: 60, borderRadius: 130, backgroundColor: 'rgba(255,153,51,0.35)' },
  top: { position: 'absolute', top: 8, start: 12, end: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progress: { flex: 1, gap: 6, paddingHorizontal: 4 },
  line: { height: 3, borderRadius: 2, overflow: 'hidden' },
  lineFill: { height: 3, borderRadius: 2 },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dismiss: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  layers: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999, borderWidth: 1 },
  hint: { textAlign: 'center' },
  chipWrap: { position: 'absolute', start: 16, end: 16 },
  doctorPill: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999, borderWidth: 1 },
});
