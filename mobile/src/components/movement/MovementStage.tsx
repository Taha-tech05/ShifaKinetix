import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { replay } from '../../movement/animationStep';
import type { AnimControl } from '../../movement/animationStep';
import type { Movement } from '../../movement/movements';
import type { Side } from '../../movement/rig';
import type { BodyLayer } from '../../regions/types';
import { useT } from '../../store/settings';
import { gradients } from '../../theme';
import { AppText } from '../AppText';
import { Boundary } from '../body3d/Boundary';
import { boxFocusView, createCameraRig, FOCUS_SECONDS, presetForSide, refocus, resetView, setPreset, startFocus } from '../body3d/cameraRig';
import type { CameraPreset, CameraRig } from '../body3d/cameraRig';
import { planEmphasis } from '../body3d/highlightPlan';
import type { Emphasis } from '../body3d/highlightPlan';
import { planFocus } from '../body3d/focusPlan';
import { deepStructureIds, structureAnchors, structureBounds } from '../body3d/packLayers';
import { LeaderLabels } from '../narrowing/LeaderLabels';
import { muscleName } from '../narrowing/CandidateStrip';
import { musclePool } from '../../dev/narrowingStub';
import { approxTrackedIds, layerFor } from '../../narrowing/approxArea';
import { SegmentedBody } from '../body3d/SegmentedBody';
import { usePack } from '../body3d/usePack';
import { useScreenFocused } from '../body3d/useScreenFocused';
import { MovementPlayer } from './MovementPlayer';
import { useTheme } from '../../ui/ThemeProvider';
import type { Palette } from '../../ui/theme';

// EXPO_PUBLIC_SIMPLE_ANIM=1 shows the simple diagram instead of the 3D body (also used when 3D is switched off).
const FORCE_SIMPLE = process.env.EXPO_PUBLIC_SIMPLE_ANIM === '1' || process.env.EXPO_PUBLIC_DISABLE_3D === '1';
const LOAD_TIMEOUT_MS = 25000;
const HINT_MS = 5000;

interface Props {
  movement: Movement;
  /** The selected side. The left arm is the mirror image of the right. Default right. */
  side?: Side;
  /** Fixed height, or leave out to fill the parent (flex: 1). */
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** Structures that can be tinted or ghosted, and what to show now (cross-fades). */
  tracked?: string[];
  emphasis?: Emphasis;
  /** True while a finger is on the model (the screen switches its own scrolling off). */
  onInteract?: (active: boolean) => void;
  /** Hold the arm at rest instead of playing the movement (question steps and the result). Replay is then hidden. */
  paused?: boolean;
  /** A camera preset to use instead of the movement's own (right-side values; the left side mirrors them). */
  cameraPreset?: CameraPreset;
  /** Muscles to tint (the live candidates). If one lies deep, the muscles over it are ghosted. Every muscle of the side can be tinted. */
  highlightIds?: string[];
  /** Muscles to label with a leader line (name only). */
  labelIds?: string[];
  /** True when the highlighted area stands in for a structure that has no mesh (joint, capsule, nerve, bone): labelled "approximate area". */
  approx?: boolean;
  /** Frame the highlighted muscles with an eased camera move when they change (question phase). A touch cancels it. */
  autoFocus?: boolean;
  /** Called once the first 3D frame is drawn (or the fallback is shown), so a screen can wait for it. */
  onReady?: () => void;
}

/**
 * The movement demo for patients: the real 3D body animated with rigid segments, in the same viewer setup as the picker
 * (same lights, same opaque material). One finger turns the view, two fingers zoom and pan, "Reset view" returns to the
 * preset and "Replay" starts the movement again. If the 3D body is missing, slow to load, switched off or fails, it
 * falls back to the simple capsule diagram with the note "Simplified diagram". The instruction and buttons on the screen
 * never depend on it.
 */
export function MovementStage({ movement, side = 'right', height, style, tracked, emphasis, onInteract, paused = false, cameraPreset, highlightIds, labelIds, approx = false, autoFocus = false, onReady }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const preset = cameraPreset ?? movement.camera;
  const t = useT();
  const focused = useScreenFocused();
  const pack = usePack(!FORCE_SIMPLE && focused);
  const [timedOut, setTimedOut] = useState(false);
  const [crashed, setCrashed] = useState(false);
  const [firstFrame, setFirstFrame] = useState(false);
  const [layer, setLayer] = useState<BodyLayer>(() => (highlightIds && highlightIds.length > 0 ? layerFor(highlightIds) : 'muscle'));
  const [boxWidth, setBoxWidth] = useState(0);
  const [boxHeight, setBoxHeight] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const lastFocusKey = useRef('');
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
  }, []);
  const [touched, setTouched] = useState(false);
  const [hintTimedOut, setHintTimedOut] = useState(false);
  const [screenPts, setScreenPts] = useState<{ id: string; x: number; y: number }[]>([]);
  const control = useRef<AnimControl>({ playing: true, speed: 1, seek: null, t: 0 });
  const rig = useRef<CameraRig | null>(null);
  if (rig.current === null) rig.current = createCameraRig(presetForSide(preset, side));

  useEffect(() => {
    if (FORCE_SIMPLE || pack.status !== 'loading') return;
    const timer = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pack.status]);

  // next movement: play it from the start; the camera eases to its preset unless the user has moved it
  useEffect(() => {
    control.current.seek = 0;
    control.current.playing = !paused;
    setPreset(rig.current!, presetForSide(preset, side));
    lastFocusKey.current = ''; // the preset took the camera: the next candidates focus again
  }, [movement.id, preset, side, paused]);

  const simple = FORCE_SIMPLE || crashed || pack.status === 'failed' || (timedOut && pack.status === 'loading');
  useEffect(() => {
    if (simple) onReady?.();
  }, [simple, onReady]);
  const ready = pack.status === 'ready' && pack.pack !== null && focused;
  const readyShown = useRef(false);
  useEffect(() => {
    if (ready && firstFrame && !readyShown.current) {
      readyShown.current = true;
      onReady?.();
    }
  }, [ready, firstFrame, onReady]);

  // the "drag to turn, pinch to zoom" hint shows for a few seconds after the model appears, or until the first touch
  useEffect(() => {
    if (!firstFrame) return;
    const timer = setTimeout(() => setHintTimedOut(true), HINT_MS);
    return () => clearTimeout(timer);
  }, [firstFrame]);

  const loaded = pack.status === 'ready' ? pack.pack : null;
  const trackedIds = useMemo(() => tracked ?? (highlightIds !== undefined || labelIds !== undefined ? [...musclePool(side), ...approxTrackedIds(side)] : undefined), [tracked, highlightIds, labelIds, side]);

  // an approximate area made of bones is shown in the bone layer, anything else in the muscle layer
  const hintKey = (highlightIds ?? []).join('|');
  const [seenHint, setSeenHint] = useState(hintKey);
  if (seenHint !== hintKey) {
    setSeenHint(hintKey);
    if (highlightIds && highlightIds.length > 0) setLayer(layerFor(highlightIds));
  }
  const emph = useMemo(() => {
    if (emphasis) return emphasis;
    if (!loaded || !highlightIds) return undefined;
    const deep = deepStructureIds(loaded);
    return planEmphasis(highlightIds, (id) => deep.has(id));
  }, [emphasis, loaded, highlightIds]);
  // auto-focus: when the candidates change, frame them (not when they did not change); the OS reduce-motion setting jumps instead
  useEffect(() => {
    if (!autoFocus || !loaded || !highlightIds || highlightIds.length === 0 || boxWidth === 0) return;
    const plan = planFocus(lastFocusKey.current, highlightIds);
    if (!plan.run) return;
    const box = structureBounds(loaded, highlightIds);
    if (!box) return;
    lastFocusKey.current = plan.key;
    startFocus(rig.current!, boxFocusView(box, side, 45, boxWidth / Math.max(1, boxHeight)), FOCUS_SECONDS, reduceMotion);
  }, [autoFocus, loaded, hintKey, side, boxWidth > 0, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  const anchorKey = (labelIds ?? []).join('|');
  const anchors = useMemo(() => {
    if (!loaded || !labelIds || labelIds.length === 0) return undefined;
    return Object.entries(structureAnchors(loaded, labelIds)).map(([id, point]) => ({ id, point }));
  }, [loaded, anchorKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const layers = useMemo(
    () => [
      { value: 'muscle' as const, label: t('layers.muscle') },
      { value: 'bone' as const, label: t('layers.bone') },
    ],
    [t],
  );

  if (simple) {
    return (
      <View style={[styles.simple, style]}>
        <MovementPlayer movement={movement} />
        <AppText variant="secondary" color={colors.muted} style={styles.note}>
          {t('movement.simplified')}
        </AppText>
      </View>
    );
  }

  return (
    <LinearGradient colors={[...gradients.studio]} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }} style={[styles.box, height !== undefined ? { height } : styles.flex, style]} onLayout={(e: LayoutChangeEvent) => {
        setBoxWidth(e.nativeEvent.layout.width);
        setBoxHeight(e.nativeEvent.layout.height);
      }}>
      {ready ? (
        <Boundary onError={() => setCrashed(true)}>
          <SegmentedBody
            pack={pack.pack!}
            movement={movement}
            side={side}
            layer={layer}
            control={control}
            cameraRig={rig as React.MutableRefObject<CameraRig>}
            tracked={trackedIds}
            emphasis={emph}
            anchors={anchors}
            onProject={setScreenPts}
            armTint={!paused}
            endGhost={!paused}
            onInteract={(active) => {
              if (active) setTouched(true);
              onInteract?.(active);
            }}
            onFirstFrame={() => setFirstFrame(true)}
          />
        </Boundary>
      ) : null}
      {!ready || !firstFrame ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.accent} />
          <AppText variant="secondary" color={colors.muted}>
            {t('body.loading3d')}
          </AppText>
        </View>
      ) : (
        <>
          {anchors ? <LeaderLabels width={boxWidth} anchors={screenPts.map((p) => ({ ...p, name: approx ? `${muscleName(p.id)} (${t('live.approxArea')})` : muscleName(p.id) }))} /> : null}
          <View style={styles.layers} accessibilityLabel={t('movement.layerLabel')}>
            {layers.map((l) => {
              const on = l.value === layer;
              return (
                <Pressable key={l.value} accessibilityRole="button" accessibilityLabel={l.label} accessibilityState={{ selected: on }} onPress={() => setLayer(l.value)} style={[styles.pill, on && styles.pillOn]}>
                  <AppText variant="secondary" color={on ? colors.onAccent : colors.text} style={styles.bold}>
                    {l.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.buttons}>
            {paused ? null : (
            <Pressable accessibilityRole="button" accessibilityLabel={t('movement.replay')} onPress={() => replay(control.current)} style={styles.pill}>
              <Ionicons name="refresh" size={18} color={colors.text} />
              <AppText variant="secondary" color={colors.text} style={styles.bold}>
                {t('movement.replay')}
              </AppText>
            </Pressable>
            )}
            {autoFocus && highlightIds && highlightIds.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('movement.refocus')} onPress={() => refocus(rig.current!, FOCUS_SECONDS, reduceMotion)} style={styles.pill}>
                <Ionicons name="scan" size={18} color={colors.text} />
                <AppText variant="secondary" color={colors.text} style={styles.bold}>
                  {t('movement.refocus')}
                </AppText>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel={t('movement.resetView')} onPress={() => resetView(rig.current!)} style={styles.pill}>
              <Ionicons name="locate" size={18} color={colors.text} />
              <AppText variant="secondary" color={colors.text} style={styles.bold}>
                {t('movement.resetView')}
              </AppText>
            </Pressable>
          </View>
          {touched || hintTimedOut || (paused && labelIds !== undefined) ? null : (
            <View style={styles.hint} pointerEvents="none">
              <AppText variant="secondary" color={colors.muted}>
                {t('movement.viewHint')}
              </AppText>
            </View>
          )}
        </>
      )}
    </LinearGradient>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  box: { borderRadius: 24, overflow: 'hidden' },
  flex: { flex: 1 },
  loading: { ...(StyleSheet.absoluteFill as object), alignItems: 'center', justifyContent: 'center', gap: 8 },
  simple: { gap: 6 },
  note: { textAlign: 'center' },
  layers: { position: 'absolute', top: 10, start: 10, flexDirection: 'row', gap: 6 },
  buttons: { position: 'absolute', bottom: 10, end: 10, flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '100%' },
  hint: { position: 'absolute', top: 14, end: 12, maxWidth: '45%' },
  pill: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1.5, borderColor: colors.line },
  pillOn: { backgroundColor: colors.chrome, borderColor: colors.chrome },
  bold: { fontWeight: '700' },
});
