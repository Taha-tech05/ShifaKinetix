import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { replay } from '../../movement/animationStep';
import type { AnimControl } from '../../movement/animationStep';
import type { Movement } from '../../movement/movements';
import type { BodyLayer } from '../../regions/types';
import { useT } from '../../store/settings';
import { colors, gradients } from '../../theme';
import { AppText } from '../AppText';
import { Boundary } from '../body3d/Boundary';
import { createCameraRig, resetView, setPreset } from '../body3d/cameraRig';
import type { CameraRig } from '../body3d/cameraRig';
import type { Emphasis } from '../body3d/highlightPlan';
import { SegmentedBody } from '../body3d/SegmentedBody';
import { usePack } from '../body3d/usePack';
import { useScreenFocused } from '../body3d/useScreenFocused';
import { MovementPlayer } from './MovementPlayer';

// EXPO_PUBLIC_SIMPLE_ANIM=1 shows the simple diagram instead of the 3D body (also used when 3D is switched off).
const FORCE_SIMPLE = process.env.EXPO_PUBLIC_SIMPLE_ANIM === '1' || process.env.EXPO_PUBLIC_DISABLE_3D === '1';
const LOAD_TIMEOUT_MS = 25000;

interface Props {
  movement: Movement;
  /** Fixed height, or leave out to fill the parent (flex: 1). */
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** Structures that can be tinted or ghosted, and what to show now (cross-fades). */
  tracked?: string[];
  emphasis?: Emphasis;
  /** True while a finger is on the model (the screen switches its own scrolling off). */
  onInteract?: (active: boolean) => void;
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
export function MovementStage({ movement, height, style, tracked, emphasis, onInteract, onReady }: Props) {
  const t = useT();
  const focused = useScreenFocused();
  const pack = usePack(!FORCE_SIMPLE && focused);
  const [timedOut, setTimedOut] = useState(false);
  const [crashed, setCrashed] = useState(false);
  const [firstFrame, setFirstFrame] = useState(false);
  const [layer, setLayer] = useState<BodyLayer>('muscle');
  const control = useRef<AnimControl>({ playing: true, speed: 1, seek: null, t: 0 });
  const rig = useRef<CameraRig | null>(null);
  if (rig.current === null) rig.current = createCameraRig(movement.camera);

  useEffect(() => {
    if (FORCE_SIMPLE || pack.status !== 'loading') return;
    const timer = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pack.status]);

  // next movement: play it from the start; the camera eases to its preset unless the user has moved it
  useEffect(() => {
    control.current.seek = 0;
    control.current.playing = true;
    setPreset(rig.current!, movement.camera);
  }, [movement.id, movement.camera]);

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
    <LinearGradient colors={[...gradients.studio]} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }} style={[styles.box, height !== undefined ? { height } : styles.flex, style]}>
      {ready ? (
        <Boundary onError={() => setCrashed(true)}>
          <SegmentedBody
            pack={pack.pack!}
            movement={movement}
            layer={layer}
            control={control}
            cameraRig={rig as React.MutableRefObject<CameraRig>}
            tracked={tracked}
            emphasis={emphasis}
            onInteract={onInteract}
            onFirstFrame={() => setFirstFrame(true)}
          />
        </Boundary>
      ) : null}
      {!ready || !firstFrame ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.teal} />
          <AppText variant="secondary" color={colors.muted}>
            {t('body.loading3d')}
          </AppText>
        </View>
      ) : (
        <>
          <View style={styles.layers} accessibilityLabel={t('movement.layerLabel')}>
            {layers.map((l) => {
              const on = l.value === layer;
              return (
                <Pressable key={l.value} accessibilityRole="button" accessibilityLabel={l.label} accessibilityState={{ selected: on }} onPress={() => setLayer(l.value)} style={[styles.pill, on && styles.pillOn]}>
                  <AppText variant="secondary" color={on ? colors.white : colors.navy} style={styles.bold}>
                    {l.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.buttons}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('movement.replay')} onPress={() => replay(control.current)} style={styles.pill}>
              <Ionicons name="refresh" size={18} color={colors.navy} />
              <AppText variant="secondary" color={colors.navy} style={styles.bold}>
                {t('movement.replay')}
              </AppText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('movement.resetView')} onPress={() => resetView(rig.current!)} style={styles.pill}>
              <Ionicons name="locate" size={18} color={colors.navy} />
              <AppText variant="secondary" color={colors.navy} style={styles.bold}>
                {t('movement.resetView')}
              </AppText>
            </Pressable>
          </View>
          <View style={styles.hint} pointerEvents="none">
            <AppText variant="secondary" color={colors.muted}>
              {t('movement.viewHint')}
            </AppText>
          </View>
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 24, overflow: 'hidden' },
  flex: { flex: 1 },
  loading: { ...(StyleSheet.absoluteFill as object), alignItems: 'center', justifyContent: 'center', gap: 8 },
  simple: { gap: 6 },
  note: { textAlign: 'center' },
  layers: { position: 'absolute', top: 10, start: 10, flexDirection: 'row', gap: 6 },
  buttons: { position: 'absolute', bottom: 10, end: 10, flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '100%' },
  hint: { position: 'absolute', top: 14, end: 12, maxWidth: '45%' },
  pill: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1.5, borderColor: colors.line },
  pillOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  bold: { fontWeight: '700' },
});
