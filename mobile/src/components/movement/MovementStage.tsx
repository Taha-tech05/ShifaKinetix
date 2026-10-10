import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Movement } from '../../movement/movements';
import { useT } from '../../store/settings';
import { colors, gradients } from '../../theme';
import { AppText } from '../AppText';
import { Boundary } from '../body3d/Boundary';
import { SegmentedBody } from '../body3d/SegmentedBody';
import type { AnimControl } from '../body3d/SegmentedBody';
import { usePack } from '../body3d/usePack';
import { useScreenFocused } from '../body3d/useScreenFocused';
import { MovementPlayer } from './MovementPlayer';

// EXPO_PUBLIC_SIMPLE_ANIM=1 shows the simple diagram instead of the 3D body (also used when 3D is switched off).
const FORCE_SIMPLE = process.env.EXPO_PUBLIC_SIMPLE_ANIM === '1' || process.env.EXPO_PUBLIC_DISABLE_3D === '1';
const LOAD_TIMEOUT_MS = 25000;

/**
 * The movement demo for patients: the real 3D body animated with rigid segments (autoplay, no controls). If the 3D body
 * is missing, slow to load, switched off or fails, it falls back to the simple capsule diagram with the note
 * "Simplified diagram". The instruction and buttons on the screen never depend on it.
 */
export function MovementStage({ movement, height = 320 }: { movement: Movement; height?: number }) {
  const t = useT();
  const focused = useScreenFocused();
  const pack = usePack(!FORCE_SIMPLE && focused);
  const [timedOut, setTimedOut] = useState(false);
  const [crashed, setCrashed] = useState(false);
  const [firstFrame, setFirstFrame] = useState(false);
  const control = useRef<AnimControl>({ playing: true, speed: 1, seek: null, t: 0 });

  useEffect(() => {
    if (FORCE_SIMPLE || pack.status !== 'loading') return;
    const timer = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pack.status]);

  useEffect(() => {
    control.current = { playing: true, speed: 1, seek: null, t: 0 };
    setFirstFrame(false);
  }, [movement.id]);

  const simple = FORCE_SIMPLE || crashed || pack.status === 'failed' || (timedOut && pack.status === 'loading');
  if (simple) {
    return (
      <View style={styles.simple}>
        <MovementPlayer movement={movement} />
        <AppText variant="secondary" color={colors.muted} style={styles.note}>
          {t('movement.simplified')}
        </AppText>
      </View>
    );
  }

  const ready = pack.status === 'ready' && pack.pack !== null && focused;
  return (
    <LinearGradient colors={[...gradients.studio]} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }} style={[styles.box, { height }]}>
      {ready ? (
        <Boundary onError={() => setCrashed(true)}>
          <SegmentedBody pack={pack.pack!} movement={movement} layer="muscle" control={control} onFirstFrame={() => setFirstFrame(true)} />
        </Boundary>
      ) : null}
      {!ready || !firstFrame ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.teal} />
          <AppText variant="secondary" color={colors.muted}>
            {t('body.loading3d')}
          </AppText>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 24, overflow: 'hidden' },
  loading: { ...(StyleSheet.absoluteFill as object), alignItems: 'center', justifyContent: 'center', gap: 8 },
  simple: { gap: 6 },
  note: { textAlign: 'center' },
});
