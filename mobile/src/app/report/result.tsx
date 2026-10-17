import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CautionStrip } from '../../components/CautionStrip';
import { MatchBar } from '../../components/narrowing/MatchBar';
import { CategoryRows, muscleName, NarrowingChips, useCategoryName } from '../../components/narrowing/CandidateStrip';
import { ASSISTANT_ENABLED } from '../../config';
import { SafeGuard } from '../../flow/SafeGuard';
import { AutoUploadNotice } from '../../server/autoUpload';
import { MOVEMENTS, localized, movementById } from '../../movement/movements';
import { approxAreaIds } from '../../narrowing/approxArea';
import { questionText } from '../../narrowing/bank';
import { structureQuestionText } from '../../narrowing/structureBank';
import type { Category } from '../../narrowing/structureBank';
import { evaluateLive } from '../../narrowing/live';
import type { LiveCandidate, LiveState } from '../../narrowing/live';
import { regionLabel } from '../../regions/shoulder';
import { sideOfRegion } from '../../regions/shoulder';
import { narrowingInputFrom, useSession } from '../../store/session';
import type { HistoryEntry } from '../../store/session';
import { useT } from '../../store/settings';
import { radius, shadows } from '../../theme';
import type { CameraPreset } from '../../components/body3d/cameraRig';
import { SceneSheetContent, useSceneStep } from '../../ui/SceneSheetContent';
import { useTheme } from '../../ui/ThemeProvider';
import type { Palette } from '../../ui/theme';

/** Upper-body camera for the result (right-side values; the left side mirrors them): front-oblique, or from behind. */
const FRONT: CameraPreset = { position: [-0.55, 1.35, 1.35], target: [-0.12, 1.25, 0], fov: 45, zoom: 1 };
const BACK: CameraPreset = { position: [-0.55, 1.35, -1.35], target: [-0.12, 1.25, 0], fov: 45, zoom: 1 };

/** The names of the movements and questions behind a candidate, in the current language. */
function evidenceName(id: string): string {
  const m = movementById(id);
  return m ? localized(m.name) : questionText(id) ?? structureQuestionText(id) ?? id;
}

/** The answer of a history entry in words: yes, no, not sure, or the movement result. Skipped and not sure are both unknown. */
function answerWords(entry: HistoryEntry, t: ReturnType<typeof useT>): string {
  if (entry.label === 'unknown') return t('answer.notSure');
  if (entry.kind === 'question') return entry.label === 'yes' ? t('answer.yes') : t('answer.no');
  const names: Record<string, string> = { noPain: t('movement.noPain'), pain: t('movement.pain'), weak: t('movement.weak'), couldNot: t('movement.couldNot') };
  return entry.label.split('+').map((p) => names[p] ?? p).join(', ');
}

/** "Review answers": every current answer in the order given, each with a Change button that reopens that question. */
function ReviewAnswers({ entries }: { entries: HistoryEntry[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  if (entries.length === 0) return null;
  return (
    <View style={styles.review}>
      <AppText variant="h3" color={colors.text}>
        {t('live.reviewAnswers')}
      </AppText>
      <AppText variant="secondary" color={colors.muted}>
        {t('live.reviewHint')}
      </AppText>
      {entries.map((e) => (
        <Pressable key={e.seq} accessibilityRole="button" accessibilityLabel={`${t('live.change')}: ${evidenceName(e.id)}`} onPress={() => router.push(`/report/movement?review=${e.id}` as never)} style={styles.reviewRow}>
          <View style={styles.col}>
            <AppText variant="secondary" color={colors.text} style={styles.bold}>
              {evidenceName(e.id)}
            </AppText>
            <AppText variant="secondary" color={colors.muted}>
              {answerWords(e, t)}
            </AppText>
          </View>
          <AppText variant="secondary" color={colors.accentText} style={styles.bold}>
            {t('live.change')}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

function CandidateRow({ c }: { c: LiveCandidate }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  return (
    <View style={styles.item}>
      <View style={styles.itemTop}>
        <AppText variant="bodyStrong" color={colors.text} style={styles.col}>
          {muscleName(c.muscleId)}
        </AppText>
        <View style={[styles.band, c.band === 'higher' ? styles.bandHigher : c.band === 'moderate' ? styles.bandModerate : styles.bandLow]}>
          <AppText variant="secondary" color={colors.text} style={styles.bold}>
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
  if (s?.outcome === 'category') return true; // not a muscle problem, or unclear: a doctor or physio
  return !s || s.candidates.length === 0 || s.cluster || s.candidates[0].band === 'low';
}

/**
 * Result (design P13): "Muscles that may be involved. Not a diagnosis. Estimate", tinted on the body with a label for each.
 * It shows EXACTLY what the live strip showed last (the state kept in the session store): nothing is computed again, so
 * the two cannot drift. Each candidate has a band, a match bar (not a probability) and a short "why". Nothing is numbered.
 * Reachable only after the verdict SAFE.
 */
export default function Result() {
  // The body, and its fallback narrowing from the stored answers, only exist once the guard has confirmed the saved SAFE verdict.
  return (
    <SafeGuard>
      <ResultBody />
    </SafeGuard>
  );
}

function ResultBody() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const saved = useSession((s) => s.liveState);
  const history = useSession((s) => s.history);
  const sel = useSession((s) => s.selection);
  // Only if the screen is opened without a live run (a direct link): evaluate once, from the stored answers.
  const fallback = useMemo<LiveState | null>(() => {
    if (saved) return null;
    const input = narrowingInputFrom(useSession.getState());
    return input ? evaluateLive(input) : null;
  }, [saved]);
  const state = saved ?? fallback;
  const candidates = state?.candidates ?? [];
  const categoryResult = state?.outcome === 'category' ? state.categoryResult : null;
  const approxCategory = categoryResult && categoryResult !== 'UNCLEAR' ? (categoryResult as Category) : null;
  const sideNow = sideOfRegion(sel?.regionId);
  const ids = useMemo(
    () => (approxCategory ? approxAreaIds(approxCategory, sideNow, sel?.subRegionId ?? null) : candidates.map((c) => c.muscleId)),
    [state], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const categoryName = useCategoryName();
  const leadCategories = (state?.structure.categories ?? []).filter((c) => c.strength > 0).filter((c) => (approxCategory ? c.category === approxCategory : categoryResult === 'UNCLEAR' ? true : c.category === state?.structure.leader));
  const where = sel ? regionLabel(sel.regionId, sel.subRegionId) : null;
  const side = sideOfRegion(sel?.regionId);
  const behind = sel?.subRegionId === 'back' || sel?.subRegionId === 'scapular';
  const doctor = suggestDoctorLive(state);
  // the same full-screen body as every other step of the flow (report/_layout draws it); this screen only says what to show on it
  useSceneStep({
    stepKey: 'result',
    mode: 'questions',
    progress: { label: t('result.title'), value: 1 },
    stage: { movement: MOVEMENTS[0], side, paused: true, autoFocus: false, highlightIds: ids, labelIds: approxCategory ? ids.slice(0, 1) : ids, approx: approxCategory !== null, cameraPreset: behind ? BACK : FRONT },
  });

  return (
    <>
      <SceneSheetContent contentKey="result" onBack={() => router.back()}>
        <CautionStrip text={t('moveSafely')} />
        <AutoUploadNotice />
        <AppText variant="h1" color={colors.text} style={styles.title}>
          {t('result.title')}
        </AppText>
        <NarrowingChips />
        {state?.stop ? (
          <AppText variant="secondary" color={colors.safe} style={styles.bold}>
            {t('live.enough')}
          </AppText>
        ) : null}
        {doctor && !categoryResult ? (
          <Card tone="mint" row>
            <Ionicons name="medkit-outline" size={24} color={colors.accentText} />
            <AppText variant="body" color={colors.text} style={styles.col}>
              {t('result.suggestDoctor')}
            </AppText>
          </Card>
        ) : null}
        {categoryResult ? (
          <>
            <AppText variant="h2" color={colors.text}>
              {categoryResult === 'UNCLEAR' ? categoryName('UNCLEAR') : t('live.notMuscleTitle')}
            </AppText>
            <AppText variant="body" color={colors.muted}>
              {categoryResult === 'UNCLEAR' ? t('live.unclearBody') : t('live.notMuscleBody')}
            </AppText>
            {leadCategories.length > 0 ? (
              <>
                {leadCategories.map((c) => (
                  <View key={c.category} style={styles.item}>
                    <CategoryRows categories={[c]} />
                    <AppText variant="secondary" color={colors.muted}>
                      {c.matched.length > 0 ? t('live.matched', { items: c.matched.map(evidenceName).join(', ') }) : t('live.noWhy')}
                    </AppText>
                    {c.unmatched.length > 0 ? (
                      <AppText variant="secondary" color={colors.muted}>
                        {t('live.unmatched', { items: c.unmatched.map(evidenceName).join(', ') })}
                      </AppText>
                    ) : null}
                  </View>
                ))}
                {approxCategory ? (
                  <AppText variant="secondary" color={colors.muted}>
                    {t('live.approxNote')}
                  </AppText>
                ) : null}
                <AppText variant="secondary" color={colors.muted} style={styles.italic}>
                  {t('live.matchCaption')}
                </AppText>
              </>
            ) : null}
          </>
        ) : candidates.length === 0 ? (
          <AppText variant="body" color={colors.muted}>
            {t('result.none')}
          </AppText>
        ) : (
          <>
            {state?.provisional ? (
              <AppText variant="secondary" color={colors.muted} style={styles.bold}>
                {t('live.possibleSoFar')}
              </AppText>
            ) : null}
            {state?.structure.leader && !state.provisional ? <CategoryRows categories={(state.structure.categories ?? []).filter((c) => c.category === state.structure.leader)} /> : null}
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
            <AppText variant="secondary" color={colors.muted} style={styles.italic}>
              {t('live.matchCaption')}
            </AppText>
          </>
        )}
        <ReviewAnswers entries={history.filter((h) => !h.supersededAt)} />
      {/*
        EXTENSION POINT (assistant). Nothing is rendered here while ASSISTANT_ENABLED is false (shared/app_config.json), and it
        must stay false in this phase: no button, no placeholder. A later phase may add its entry point below, behind the flag.
      */}
      {ASSISTANT_ENABLED ? null : null}
        <Button label={t('result.seeAdvice')} onPress={() => router.push('/report/choice')} />
        <Button variant="text" label={categoryResult ? t('live.talkPhysio') : t('result.talkDoctor')} onPress={() => router.push('/report/doctor')} />
      </SceneSheetContent>
    </>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  title: { paddingTop: 4 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  col: { flex: 1 },
  review: { gap: 8, paddingTop: 4 },
  reviewRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  item: { gap: 6, padding: 12, borderRadius: radius.card, backgroundColor: colors.surface, ...shadows.card },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  band: { paddingHorizontal: 10, minHeight: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bandLow: { backgroundColor: colors.neutral },
  bandModerate: { backgroundColor: colors.cautionTint },
  bandHigher: { backgroundColor: colors.accentTint },
});
