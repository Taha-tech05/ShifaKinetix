import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { DemoCautionStrip } from '../../components/DemoCautionStrip';
import { MovementStage } from '../../components/movement/MovementStage';
import { CandidateStrip } from '../../components/narrowing/CandidateStrip';
import { ProgressBar } from '../../components/ProgressBar';
import { Screen } from '../../components/Screen';
import type { TKey } from '../../i18n';
import { activeHistory, firstOpenStep, goBack, seedLiveState, LIVE_RESULT_ROUTE, liveSteps, nextStepIndex, stepIndexOf, submitMovement, submitQuestion, totalSteps } from '../../flow/live';
import type { LiveOutcome } from '../../flow/live';
import { textMaxFor, viewerHeightFor } from '../../flow/liveLayout';
import { SafeGuard } from '../../flow/SafeGuard';
import { MOVEMENTS, localized, movementById } from '../../movement/movements';
import { buildMovementResult } from '../../movement/result';
import type { Feel } from '../../movement/result';
import { discriminatorQuestions } from '../../narrowing/bank';
import { structureQuestions } from '../../narrowing/structureBank';
import { answered, unknown } from '../../questions/answer';
import { sideOfRegion } from '../../regions/shoulder';
import { useChrome } from '../../store/chrome';
import { useSession } from '../../store/session';
import type { HistoryEntry } from '../../store/session';
import { useT } from '../../store/settings';
import { colors, MIN_TAP, radius } from '../../theme';

type Key = 'noPain' | 'pain' | 'weak' | 'couldNot' | 'unsure';
const FEEL: { key: Key; label: TKey }[] = [
  { key: 'noPain', label: 'movement.noPain' },
  { key: 'pain', label: 'movement.pain' },
  { key: 'weak', label: 'movement.weak' },
  { key: 'couldNot', label: 'movement.couldNot' },
  { key: 'unsure', label: 'answer.notSure' },
];

/** A tap-to-answer chip: at least 48 high, shares the row with the others, mirrors in right-to-left languages. */
function Chip({ label, on = false, onPress, grow = true }: { label: string; on?: boolean; onPress: () => void; grow?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress} style={[styles.chip, grow && styles.grow, on && styles.chipOn]}>
      <AppText variant="secondary" color={on ? colors.white : colors.navy} style={styles.chipText} numberOfLines={2}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** What a stored movement answer looked like, to show it selected again when the question is shown a second time. */
function pickedFrom(entry: HistoryEntry | null): Set<Key> {
  const m = entry?.movement;
  if (!m) return new Set();
  if (m.state === 'unknown') return new Set(entry?.label === 'unknown' ? ['unsure' as Key] : []);
  const out = new Set<Key>();
  if (m.painful) out.add('pain');
  if (m.weak) out.add('weak');
  if (m.unableToDo) out.add('couldNot');
  if (out.size === 0) out.add('noPain');
  return out;
}

/**
 * The live screen: movements and questions in one place, laid out to be seen at a glance WITHOUT scrolling: a slim header, one slim
 * strip with the demo and caution messages, the 3D model (about 40 to 45 percent of the height, it shrinks if the card needs
 * more), a compact strip of the possible muscles, and the question card with its answer chips pinned at the bottom. Only the
 * question text can scroll inside the card; the answer buttons are always on screen.
 *
 * After every answer, "Not sure" and "Skip" included, the Severity Gate runs again and the narrowing is recomputed (flow/live.ts).
 * Back goes to the previous question and recomputes everything from the answers that remain.
 * "Not sure" and "Skip" are stored as state "unknown", never as "no". Only after the verdict SAFE.
 */
export default function LiveScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ review?: string }>();
  const mode = useSession((s) => s.mode);
  const selection = useSession((s) => s.selection);
  const savedState = useSession((s) => s.liveState);
  // before the first answer the possible muscles already exist (seeded from the tapped area), so the model is highlighted at once
  const liveState = useMemo(() => savedState ?? seedLiveState(), [savedState]);
  const side = sideOfRegion(selection?.regionId);
  const steps = useMemo(() => liveSteps(mode ?? 'region'), [mode]);
  const total = totalSteps(mode ?? 'region');
  const questions = useMemo(() => [...structureQuestions(), ...discriminatorQuestions()], [t]);
  const reviewIndex = params.review ? stepIndexOf(mode ?? 'region', params.review) : -1;
  // continue where the patient left off (the answers are in the session), not from the start
  const [index, setIndex] = useState(() =>
    reviewIndex >= 0
      ? reviewIndex
      : firstOpenStep(steps, useSession.getState().movementResults.map((m) => m.movementId), useSession.getState().answers.map((a) => a.questionId), useSession.getState().liveState?.muscleAllowed === true),
  );
  const [phase, setPhase] = useState<'try' | 'feel'>('try');
  const [picked, setPicked] = useState<Set<Key>>(new Set());
  const [prefill, setPrefill] = useState<HistoryEntry | null>(() => (reviewIndex >= 0 ? activeHistory().find((h) => h.id === params.review) ?? null : null));
  const [finished, setFinished] = useState(() => reviewIndex < 0 && useSession.getState().liveState?.stop === true);
  const [reviewing, setReviewing] = useState(reviewIndex >= 0);
  const [touching, setTouching] = useState(false);
  const [cameraNote, setCameraNote] = useState(false);
  const [height, setHeight] = useState(0);
  const lastMovement = useRef(MOVEMENTS[0]);

  // the question screen draws one strip with both the demo and the caution message instead of two banners
  useEffect(() => {
    useChrome.getState().setCompact(true);
    return () => useChrome.getState().setCompact(false);
  }, []);

  // opened from "Review answers": show that question again with the current answer selected
  useEffect(() => {
    if (reviewIndex < 0) return;
    setIndex(reviewIndex);
    setFinished(false);
    setReviewing(true);
    const entry = activeHistory().find((h) => h.id === params.review) ?? null;
    setPrefill(entry);
    setPicked(entry?.kind === 'movement' ? pickedFrom(entry) : new Set());
    setPhase(entry?.kind === 'movement' ? 'feel' : 'try');
  }, [params.review]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = steps[Math.min(index, steps.length - 1)];
  const onMovement = step.kind === 'movement' && !finished;
  const current = step.kind === 'movement' ? movementById(step.id) ?? MOVEMENTS[0] : lastMovement.current;
  if (step.kind === 'movement') lastMovement.current = current;
  const question = step.kind !== 'movement' ? questions.find((q) => q.questionId === step.id) : undefined;
  // the possible muscles are highlighted from the first screen and follow every answer
  const highlightIds = useMemo(() => liveState?.candidates.map((c) => c.muscleId) ?? [], [liveState]);

  const resetStep = (entry: HistoryEntry | null) => {
    setPrefill(entry);
    setPicked(entry?.kind === 'movement' ? pickedFrom(entry) : new Set());
    setPhase(entry?.kind === 'movement' ? 'feel' : 'try');
    setCameraNote(false);
  };

  const handle = (out: LiveOutcome) => {
    if (out.route) {
      router.replace(out.route as never);
      return;
    }
    let next = nextStepIndex(mode ?? 'region', index, out);
    if (reviewing) {
      // after a change: go on to the first question that still has no answer, or back to the result
      const done = new Set(activeHistory().map((h) => h.id));
      const open = steps.findIndex((st) => !done.has(st.id) && !(st.kind === 'structure' && out.state?.muscleAllowed));
      if (out.state?.stop || open < 0) {
        router.replace(LIVE_RESULT_ROUTE as never);
        return;
      }
      setReviewing(false);
      next = open;
    }
    if (next === null) {
      setFinished(true);
      return;
    }
    setIndex(next);
    resetStep(null);
  };

  const leave = () => router.back();
  const confirmLeave = () => Alert.alert(t('live.leaveTitle'), t('live.leaveBody'), [{ text: t('live.stay') }, { text: t('live.leave'), onPress: leave }]);

  /** Back: the previous question again, with everything recomputed from the answers that remain. */
  const previous = useCallback(() => {
    const r = goBack();
    if (!r.ok) {
      if (r.reason === 'empty') confirmLeave(); // on the first question: confirm before leaving the flow
      return; // after an escalation back does nothing
    }
    if (r.route) {
      router.replace(r.route as never);
      return;
    }
    const idx = r.undone ? stepIndexOf(mode ?? 'region', r.undone.id) : -1;
    if (idx >= 0) setIndex(idx);
    setFinished(false);
    setReviewing(false);
    resetStep(r.undone ?? null);
  }, [mode, t]); // eslint-disable-line react-hooks/exhaustive-deps

  // the Android back button and the back swipe mean "previous question"
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        previous();
        return true;
      });
      return () => sub.remove();
    }, [previous]),
  );

  const answerMovement = (feel: Feel, label: string) => handle(submitMovement(buildMovementResult(current.id, feel), label));
  const skipMovement = () => answerMovement({ kind: 'skip' }, 'skip');
  const toggle = (k: Key) => {
    if (k === 'unsure') return answerMovement({ kind: 'unsure' }, 'unsure');
    if (k === 'noPain') return answerMovement({ kind: 'felt', pain: false, weak: false, couldNot: false }, 'noPain');
    const next = new Set(picked);
    next.delete('noPain');
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setPicked(next);
  };
  const submitPicked = () => answerMovement({ kind: 'felt', pain: picked.has('pain'), weak: picked.has('weak'), couldNot: picked.has('couldNot') }, [...picked].join('+'));
  const answerQuestion = (kind: 'yes' | 'no' | 'unsure') => {
    if (!question) return;
    handle(submitQuestion(kind === 'yes' ? answered(question, true) : kind === 'no' ? answered(question, false) : unknown(question)));
  };
  const selected = (kind: 'yes' | 'no' | 'unsure') => {
    const a = prefill?.answer;
    if (!a) return false;
    return kind === 'unsure' ? a.state === 'unknown' : a.state === 'answered' && a.value === (kind === 'yes');
  };

  if (!mode) return <Redirect href="/report/fork" />;
  const viewerHeight = viewerHeightFor(height);
  const asked = (liveState ? liveState.structure.asked + liveState.asked : 0) + 1;
  const n = Math.min(asked, total);
  const textMax = textMaxFor(height);

  return (
    <SafeGuard>
      <Screen scroll={false} compact onBack={previous} banner={<DemoCautionStrip />}>
        <View style={styles.fill} onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}>
          <MovementStage
            movement={current}
            side={side}
            height={viewerHeight}
            style={styles.viewer}
            paused={!onMovement}
            highlightIds={highlightIds}
            autoFocus={!onMovement}
            onInteract={setTouching}
          />
          <View style={styles.bottom}>
            <View style={styles.progressRow}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('live.back')} onPress={previous} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color={colors.navy} />
              </Pressable>
              <View style={styles.progress}>
                <AppText variant="secondary" color={colors.muted} style={styles.bold} numberOfLines={1}>
                  {t('live.questionOf', { n, total })}
                </AppText>
                <ProgressBar value={n / total} />
              </View>
            </View>
            <CandidateStrip state={liveState} />
            <View style={styles.card}>
              {finished ? (
                <Button label={t('live.seeResult')} onPress={() => router.replace(LIVE_RESULT_ROUTE as never)} />
              ) : step.kind === 'movement' && phase === 'try' ? (
                <>
                  <ScrollView style={{ maxHeight: textMax }} scrollEnabled={!touching} showsVerticalScrollIndicator={false}>
                    <AppText variant="h3" color={colors.navy}>
                      {localized(current.name)}
                    </AppText>
                    <AppText variant="secondary">{localized(current.instruction)}</AppText>
                    {current.cameraMeasurable ? (
                      <Pressable accessibilityRole="button" onPress={() => setCameraNote(true)} style={styles.cameraLink}>
                        <AppText variant="secondary" color={colors.linkTeal} style={styles.bold}>
                          {cameraNote ? t('movement.cameraNote') : t('movement.camera')}
                        </AppText>
                      </Pressable>
                    ) : null}
                  </ScrollView>
                  <View style={styles.row}>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('movement.tried')} onPress={() => setPhase('feel')} style={[styles.primary, styles.grow2]}>
                      <AppText variant="button" color={colors.white}>
                        {t('movement.tried')}
                      </AppText>
                    </Pressable>
                    <Chip label={t('movement.skip')} onPress={skipMovement} />
                  </View>
                </>
              ) : step.kind === 'movement' ? (
                <>
                  <AppText variant="h3" color={colors.navy} numberOfLines={2}>
                    {t('movement.feelTitle')}
                  </AppText>
                  <View style={styles.rowWrap}>
                    {FEEL.map((f) => (
                      <Chip key={f.key} label={t(f.label)} on={picked.has(f.key)} onPress={() => toggle(f.key)} />
                    ))}
                    <Chip label={t('movement.skip')} onPress={skipMovement} />
                  </View>
                  {picked.size > 0 ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={t('live.done')} onPress={submitPicked} style={styles.primary}>
                      <AppText variant="button" color={colors.white}>
                        {t('live.done')}
                      </AppText>
                    </Pressable>
                  ) : null}
                </>
              ) : question ? (
                <>
                  <ScrollView style={{ maxHeight: textMax }} scrollEnabled={!touching} showsVerticalScrollIndicator={false}>
                    <AppText variant="h3" color={colors.navy}>
                      {question.text}
                    </AppText>
                  </ScrollView>
                  <View style={styles.row}>
                    <Chip label={t('answer.yes')} on={selected('yes')} onPress={() => answerQuestion('yes')} />
                    <Chip label={t('answer.no')} on={selected('no')} onPress={() => answerQuestion('no')} />
                    <Chip label={t('answer.notSure')} on={selected('unsure')} onPress={() => answerQuestion('unsure')} />
                    <Chip label={t('movement.skip')} onPress={() => answerQuestion('unsure')} />
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </View>
      </Screen>
    </SafeGuard>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, gap: 6 },
  viewer: { flexShrink: 1, minHeight: 140 },
  bottom: { flexShrink: 0, gap: 6 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backBtn: { width: MIN_TAP, height: MIN_TAP, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  progress: { flex: 1, gap: 4 },
  bold: { fontWeight: '700' },
  card: { gap: 6, padding: 10, borderRadius: radius.card, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', gap: 6 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  grow: { flexGrow: 1, flexBasis: 0 },
  grow2: { flexGrow: 2, flexBasis: 0 },
  chip: { minHeight: MIN_TAP, minWidth: MIN_TAP, paddingHorizontal: 6, borderRadius: 24, borderWidth: 2, borderColor: colors.fieldBorder, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { textAlign: 'center', fontWeight: '700' },
  primary: { minHeight: MIN_TAP, borderRadius: 24, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  cameraLink: { minHeight: 32, justifyContent: 'center' },
});
