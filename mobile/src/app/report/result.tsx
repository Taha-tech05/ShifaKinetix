import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CautionStrip } from '../../components/CautionStrip';
import { MovementStage } from '../../components/movement/MovementStage';
import { MatchBar } from '../../components/narrowing/MatchBar';
import { muscleName, NarrowingChips } from '../../components/narrowing/CandidateStrip';
import { Screen } from '../../components/Screen';
import { StepProgress } from '../../components/StepProgress';
import { SafeGuard } from '../../flow/SafeGuard';
import { MOVEMENTS, localized, movementById } from '../../movement/movements';
import { questionText } from '../../narrowing/bank';
import { evaluateLive } from '../../narrowing/live';
import type { LiveCandidate, LiveState } from '../../narrowing/live';
import { regionLabel } from '../../regions/shoulder';
import { sideOfRegion } from '../../regions/shoulder';
import { narrowingInputFrom, useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { colors, radius, shadows } from '../../theme';
import type { CameraPreset } from '../../components/body3d/cameraRig';

/** Upper-body camera for the result (right-side values; the left side mirrors them): front-oblique, or from behind. */
const FRONT: CameraPreset = { position: [-0.55, 1.35, 1.35], target: [-0.12, 1.25, 0], fov: 45, zoom: 1 };
const BACK: CameraPreset = { position: [-0.55, 1.35, -1.35], target: [-0.12, 1.25, 0], fov: 45, zoom: 1 };

/** The names of the movements and questions behind a candidate, in the current language. */
function evidenceName(id: string): string {
  const m = movementById(id);
  return m ? localized(m.name) : questionText(id) ?? id;
}

function CandidateRow({ c }: { c: LiveCandidate }) {
  const t = useT();
  return (
    <View style={styles.item}>
      <View style={styles.itemTop}>
        <AppText variant="bodyStrong" color={colors.navy} style={styles.col}>
          {muscleName(c.muscleId)}
        </AppText>
        <View style={[styles.band, c.band === 'higher' ? styles.bandHigher : c.band === 'moderate' ? styles.bandModerate : styles.bandLow]}>
          <AppText variant="secondary" color={colors.navy} style={styles.bold}>
            {t(`live.band.${c.band}` as const)}
          </AppText>
        </View>
      </View>
      <MatchBar strength={c.strength} band={c.band} />
      <AppText variant="secondary" color={colors.muted}>
        {c.matched.length > 0 ? t('live.matched', { items: c.matched.map(evidenceName).join(', ') }) : t('live.noWhy')}
      </AppText>
      {c.unmatched.length > 0 ? (
        <AppText variant="secondary" color={colors.muted}>
          {t('live.unmatched', { items: c.unmatched.map(evidenceName).join(', ') })}
        </AppText>
      ) : null}
    </View>
  );
}

/** A doctor is suggested when the candidates are one cluster, when none stands out, or when the best match is only Low. */
export function suggestDoctorLive(s: LiveState | null): boolean {
  return !s || s.candidates.length === 0 || s.cluster || s.candidates[0].band === 'low';
}

/**
 * Result (design P13): "Muscles that may be involved. Not a diagnosis. Estimate", tinted on the body with a label for each.
 * It shows EXACTLY what the live strip showed last (the state kept in the session store): nothing is computed again, so
 * the two cannot drift. Each candidate has a band, a match bar (not a probability) and a short "why". Nothing is numbered.
 * Reachable only after the verdict SAFE.
 */
export default function Result() {
  const t = useT();
  const saved = useSession((s) => s.liveState);
  const sel = useSession((s) => s.selection);
  const [touching, setTouching] = useState(false);
  // Only if the screen is opened without a live run (a direct link): evaluate once, from the stored answers.
  const fallback = useRef<LiveState | null>(null);
  if (!saved && fallback.current === null) {
    const input = narrowingInputFrom(useSession.getState());
    fallback.current = input ? evaluateLive(input) : null;
  }
  const state = saved ?? fallback.current;
  const candidates = state?.candidates ?? [];
  const ids = useMemo(() => candidates.map((c) => c.muscleId), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const where = sel ? regionLabel(sel.regionId, sel.subRegionId) : null;
  const side = sideOfRegion(sel?.regionId);
  const behind = sel?.subRegionId === 'back' || sel?.subRegionId === 'scapular';
  const doctor = suggestDoctorLive(state);

  return (
    <SafeGuard>
      <Screen
        scrollEnabled={!touching}
        onBack={() => router.back()}
        banner={<CautionStrip text={t('moveSafely')} />}
        footer={
          <>
            <Button label={t('result.seeAdvice')} onPress={() => router.push('/report/choice')} />
            <Button variant="text" label={t('result.talkDoctor')} onPress={() => router.push('/report/doctor')} />
          </>
        }
      >
        <StepProgress step={5} total={5} />
        <AppText variant="h1" color={colors.navy} style={styles.title}>
          {t('result.title')}
        </AppText>
        <NarrowingChips />
        <MovementStage movement={MOVEMENTS[0]} side={side} height={320} paused cameraPreset={behind ? BACK : FRONT} highlightIds={ids} labelIds={ids} onInteract={setTouching} />
        {state?.stop ? (
          <AppText variant="secondary" color={colors.safe} style={styles.bold}>
            {t('live.enough')}
          </AppText>
        ) : null}
        {doctor ? (
          <Card tone="mint" row>
            <Ionicons name="medkit-outline" size={24} color={colors.tealDark} />
            <AppText variant="body" color={colors.navy} style={styles.col}>
              {t('result.suggestDoctor')}
            </AppText>
          </Card>
        ) : null}
        {candidates.length === 0 ? (
          <AppText variant="body" color={colors.muted}>
            {t('result.none')}
          </AppText>
        ) : (
          <>
            {state?.cluster ? (
              <AppText variant="secondary" color={colors.muted}>
                {t('live.clusterNote')}
              </AppText>
            ) : null}
            {where ? (
              <AppText variant="secondary" color={colors.muted}>
                {where}
              </AppText>
            ) : null}
            {candidates.map((c) => (
              <CandidateRow key={c.muscleId} c={c} />
            ))}
            <AppText variant="secondary" color={colors.muted}>
              {t('live.matchCaption')}
            </AppText>
          </>
        )}
      </Screen>
    </SafeGuard>
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: 4 },
  bold: { fontWeight: '700' },
  col: { flex: 1 },
  item: { gap: 6, padding: 12, borderRadius: radius.card, backgroundColor: colors.white, ...shadows.card },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  band: { paddingHorizontal: 10, minHeight: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bandLow: { backgroundColor: colors.neutralTint },
  bandModerate: { backgroundColor: colors.cautionTint },
  bandHigher: { backgroundColor: colors.tealTint },
});
