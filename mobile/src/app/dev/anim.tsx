// DEV ONLY (EXPO_PUBLIC_DEV_ANIM=1): test screen for the movement animation on the real 3D body. Not shown in normal
// builds: without the flag this route redirects home and nothing links to it.
// Optional link parameters (also used for emulator screenshots): m=<movement id>, layer=muscle|bone, view=front|side,
// t=<0..1>, paused=1, speed=0.25|0.5|1.   Example: /dev/anim?m=sideways_raise&layer=bone&t=0.25&paused=1
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { AppText } from '../../components/AppText';
import { Boundary } from '../../components/body3d/Boundary';
import { createCameraRig, presetFacing, resetView, setPreset } from '../../components/body3d/cameraRig';
import type { CameraRig } from '../../components/body3d/cameraRig';
import { SegmentedBody } from '../../components/body3d/SegmentedBody';
import type { AnimControl, FrameInfo } from '../../components/body3d/SegmentedBody';
import { usePack } from '../../components/body3d/usePack';
import { useScreenFocused } from '../../components/body3d/useScreenFocused';
import { Screen } from '../../components/Screen';
import { MOVEMENTS, VALUES_LABEL, localized } from '../../movement/movements';
import type { BodyLayer } from '../../regions/types';
import { colors, radius, spacing } from '../../theme';

const ENABLED = process.env.EXPO_PUBLIC_DEV_ANIM === '1';
const SPEEDS = [0.25, 0.5, 1];

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <AppText variant="secondary" color={on ? colors.white : colors.navy} style={styles.bold}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Drag or tap along the bar to jump to a time in the loop. */
function Scrubber({ value, onScrub }: { value: number; onScrub: (t: number) => void }) {
  const width = useRef(1);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => onScrub(Math.min(1, Math.max(0, e.nativeEvent.locationX / width.current))),
        onPanResponderMove: (e) => onScrub(Math.min(1, Math.max(0, e.nativeEvent.locationX / width.current))),
      }),
    [onScrub],
  );
  return (
    <View style={styles.scrub} onLayout={(e: LayoutChangeEvent) => (width.current = e.nativeEvent.layout.width)} {...responder.panHandlers} accessibilityLabel="Time scrubber">
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${value * 100}%` }]} />
      </View>
      <View style={[styles.knob, { left: `${value * 100}%` }]} />
    </View>
  );
}

export default function DevAnim() {
  const params = useLocalSearchParams<{ m?: string; layer?: string; view?: string; t?: string; paused?: string; speed?: string }>();
  const focused = useScreenFocused();
  const pack = usePack(ENABLED && focused);
  const [id, setId] = useState(params.m && MOVEMENTS.some((m) => m.id === params.m) ? params.m : MOVEMENTS[0].id);
  const [layer, setLayer] = useState<BodyLayer>(params.layer === 'bone' ? 'bone' : 'muscle');
  const [view, setView] = useState<'front' | 'side' | null>(params.view === 'front' || params.view === 'side' ? params.view : null);
  const [speed, setSpeed] = useState(SPEEDS.includes(Number(params.speed)) ? Number(params.speed) : 1);
  const [playing, setPlaying] = useState(params.paused !== '1');
  const [info, setInfo] = useState<FrameInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const startT = params.t !== undefined && !Number.isNaN(Number(params.t)) ? Math.min(1, Math.max(0, Number(params.t))) : 0;
  const lastLog = useRef(0);
  const control = useRef<AnimControl>({ playing: params.paused !== '1', speed, seek: startT, t: startT });
  const movement = MOVEMENTS.find((m) => m.id === id) ?? MOVEMENTS[0];
  const rig = useRef<CameraRig | null>(null);
  if (rig.current === null) rig.current = createCameraRig(view ? presetFacing(movement.camera, view) : movement.camera);
  // a movement or a Front/Side choice sets the preset; a touch on the model stops it until Reset view
  useEffect(() => {
    setPreset(rig.current!, view ? presetFacing(movement.camera, view) : movement.camera);
  }, [movement, view]);

  // The router can fill the link parameters in after the first render, so apply them whenever they change.
  useEffect(() => {
    if (params.m && MOVEMENTS.some((x) => x.id === params.m)) setId(params.m);
    if (params.layer === 'bone' || params.layer === 'muscle') setLayer(params.layer);
    if (params.view === 'front' || params.view === 'side') setView(params.view);
    const sp = Number(params.speed);
    if (SPEEDS.includes(sp)) {
      control.current.speed = sp;
      setSpeed(sp);
    }
    if (params.paused === '1') {
      control.current.playing = false;
      setPlaying(false);
    }
    const tt = Number(params.t);
    if (params.t !== undefined && !Number.isNaN(tt)) control.current.seek = Math.min(1, Math.max(0, tt));
  }, [params.m, params.layer, params.view, params.t, params.paused, params.speed]);

  if (!ENABLED) return <Redirect href="/" />;

  const setPlay = (p: boolean) => {
    control.current.playing = p;
    setPlaying(p);
  };
  const pickSpeed = (s: number) => {
    control.current.speed = s;
    setSpeed(s);
  };
  const pickMovement = (m: string) => {
    control.current.seek = 0;
    setId(m);
  };
  const scrub = (t: number) => {
    control.current.seek = t;
    if (control.current.playing) setPlay(false);
  };
  // dev logging: one line every 2 seconds, so the frame rate can be read from the Metro log during a test run
  const onFrame = (i: FrameInfo) => {
    setInfo(i);
    const now = Date.now();
    if (now - lastLog.current > 2000) {
      lastLog.current = now;
      console.log(`[anim-fps] ${movement.id} ${layer} fps=${i.fps} t=${i.t.toFixed(2)} playing=${control.current.playing}`);
    }
  };
  const p = info?.pose;
  const f = (n?: number) => (n === undefined ? '-' : n.toFixed(1));

  return (
    <Screen scroll={false}>
      <View style={styles.banner}>
        <AppText variant="secondary" color={colors.caution} style={styles.bold}>
          DEV ANIMATION. {VALUES_LABEL}
        </AppText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ gap: spacing.sm }}>
        {MOVEMENTS.map((m) => (
          <Chip key={m.id} label={localized(m.name, 'en')} on={m.id === id} onPress={() => pickMovement(m.id)} />
        ))}
      </ScrollView>

      <View style={styles.stage}>
        {pack.status === 'ready' && pack.pack && focused && !failed ? (
          <Boundary onError={() => setFailed(true)}>
            <SegmentedBody pack={pack.pack} movement={movement} layer={layer} control={control} cameraRig={rig as React.MutableRefObject<CameraRig>} onFrame={onFrame} />
          </Boundary>
        ) : (
          <View style={styles.center}>
            <AppText variant="body" color={colors.muted}>
              {failed || pack.status === 'failed' ? '3D model unavailable' : 'Loading 3D model...'}
            </AppText>
          </View>
        )}
      </View>

      <View style={styles.readout}>
        <AppText variant="secondary" color={colors.navy} style={styles.mono}>
          {`t ${f(info ? info.t * 100 : undefined)}%  loop ${movement.loopSeconds}s  fps ${info?.fps ?? '-'}  gap ${f(info?.gapMm)} mm`}
        </AppText>
        <AppText variant="secondary" color={colors.navy} style={styles.mono}>
          {`elevation ${f(p?.elevation)}  plane ${f(p?.plane)}  rotation ${f(p?.rotation)}`}
        </AppText>
        <AppText variant="secondary" color={colors.navy} style={styles.mono}>
          {`elbow ${f(p?.elbow)}  scapula ${f(p?.scapula)}  (degrees)`}
        </AppText>
      </View>

      <Scrubber value={info?.t ?? startT} onScrub={scrub} />
      <View style={styles.row}>
        <Chip label={playing ? 'Pause' : 'Play'} on={false} onPress={() => setPlay(!playing)} />
        {SPEEDS.map((s) => (
          <Chip key={s} label={`${s}x`} on={speed === s} onPress={() => pickSpeed(s)} />
        ))}
      </View>
      <View style={styles.row}>
        <Chip label="Front" on={view === 'front'} onPress={() => { setView('front'); resetView(rig.current!); }} />
        <Chip label="Side" on={view === 'side'} onPress={() => { setView('side'); resetView(rig.current!); }} />
        <Chip label="Reset view" on={false} onPress={() => resetView(rig.current!)} />
        <Chip label="Muscle" on={layer === 'muscle'} onPress={() => setLayer('muscle')} />
        <Chip label="Bone" on={layer === 'bone'} onPress={() => setLayer('bone')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.cautionTint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  chips: { flexGrow: 0 },
  chip: { minHeight: 44, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  bold: { fontWeight: '700' },
  stage: { flex: 1, minHeight: 260, borderRadius: 20, overflow: 'hidden', backgroundColor: '#EEF6F7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  readout: { gap: 2 },
  mono: { fontFamily: 'monospace', fontSize: 13 },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  scrub: { height: 40, justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.teal },
  knob: { position: 'absolute', width: 24, height: 24, borderRadius: 12, marginStart: -12, top: 8, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.teal },
});
