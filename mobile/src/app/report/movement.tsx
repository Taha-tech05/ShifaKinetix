import { Redirect, router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { CautionStrip } from '../../components/CautionStrip';
import { MovementStage } from '../../components/movement/MovementStage';
import { CandidateStrip } from '../../components/narrowing/CandidateStrip';
import { Screen } from '../../components/Screen';
import { StepProgress } from '../../components/StepProgress';
import type { TKey } from '../../i18n';
import { firstOpenStep, LIVE_RESULT_ROUTE, liveSteps, nextStepIndex, submitMovement, submitQuestion, totalSteps } from '../../flow/live';
import type { LiveOutcome } from '../../flow/live';
import { SafeGuard } from '../../flow/SafeGuard';
import { MOVEMENTS, localized, movementById } from '../../movement/movements';
import { buildMovementResult } from '../../movement/result';
import type { Feel } from '../../movement/result';
import { discriminatorQuestions } from '../../narrowing/bank';
import { answered, unknown } from '../../questions/answer';
import { sideOfRegion } from '../../regions/shoulder';
import { useSession } from '../../store/session';
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

/** A tap-to-answer chip: at least 48 high, wraps with the others, mirrors in right-to-left languages. */
function AnswerChip({ label, on = false, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <AppText variant="button" color={on ? colors.white : colors.navy} style={styles.chipText}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * The live screen (movement + questions in one place). Layout, top to bottom: the 3D model (about 55 percent of the height,
 * turn and zoom with your fingers while the movement plays), the strip of candidates so far, and the question card with
 * tap-to-answer chips. After every answer, "Not sure" and "Skip" included, the Severity Gate runs again and the narrowing
 * is updated (flow/live.ts). Only after the verdict SAFE. "Not sure" and "Skip" are stored as state "unknown", never as "no".
 */
export default function LiveScreen() {
  const t = useT();
  const mode = useSession((s) => s.mode);
  const selection = useSession((s) => s.selection);
  const liveState = useSession((s) => s.liveState);
  const side = sideOfRegion(selection?.regionId);
  const steps = useMemo(() => liveSteps(mode ?? 'region'), [mode]);
  const total = totalSteps(mode ?? 'region');
  const questions = useMemo(() => discriminatorQuestions(), [t]);
  // continue where the patient left off (the answers are in the session), not from the start
  const [index, setIndex] = useState(() => firstOpenStep(steps, useSession.getState().movementResults.map((m) => m.movementId), useSession.getState().answers.map((a) => a.questionId)));
  const [phase, setPhase] = useState<'try' | 'feel'>('try');
  const [picked, setPicked] = useState<Set<Key>>(new Set());
  const [finished, setFinished] = useState(() => useSession.getState().liveState?.stop === true);
  const [touching, setTouching] = useState(false);
  const [cameraNote, setCameraNote] = useState(false);
  const [height, setHeight] = useState(0);
  const lastMovement = useRef(MOVEMENTS[0]);

  const step = steps[Math.min(index, steps.length - 1)];
  const onMovement = step.kind === 'movement' && !finished;
  const current = step.kind === 'movement' ? movementById(step.id) ?? MOVEMENTS[0] : lastMovement.current;
  if (step.kind === 'movement') lastMovement.current = current;
  const question = step.kind === 'question' ? questions.find((q) => q.questionId === step.id) : undefined;
  const highlightIds = useMemo(() => liveState?.candidates.map((c) => c.muscleId) ?? [], [liveState]);

  const handle = (out: LiveOutcome) => {
    if (out.route) {
      router.replace(out.route as never);
      return;
    }
    const next = nextStepIndex(mode ?? 'region', index, out);
    if (next === null) {
      setFinished(true);
      return;
    }
    setIndex(next);
    setPhase('try');
    setPicked(new Set());
    setCameraNote(false);
  };

  const answerMovement = (feel: Feel, label: string) => handle(submitMovement(buildMovementResult(current.id, feel), label));
  const skipMovement = () => answerMovement({ kind: 'skip' }, 'skip');
  const toggle = (k: Key) => {
    if (k === 'unsure') return answerMovement({ kind: 'unsure' }, 'unsure');
    if (k === 'noPain') return answerMovement({ kind: 'felt', pain: false, weak: false, couldNot: false }, 'noPain');
    const next = new Set(picked);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setPicked(next);
  };
  const submitPicked = () => answerMovement({ kind: 'felt', pain: picked.has('pain'), weak: picked.has('weak'), couldNot: picked.has('couldNot') }, [...picked].join('+'));

  if (!mode) return <Redirect href="/report/fork" />;
  const modelHeight = Math.max(220, Math.round(height * 0.55));

  return (
    <SafeGuard>
      <Screen scroll={false} onBack={() => router.back()} banner={<CautionStrip text={t('moveSafely')} />}>
        <View style={styles.fill} onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}>
          <MovementStage movement={current} side={side} height={modelHeight} paused={!onMovement} highlightIds={highlightIds} onInteract={setTouching} />
          <ScrollView style={styles.fill} contentContainerStyle={styles.lower} scrollEnabled={!touching} showsVerticalScrollIndicator={false}>
            <StepProgress step={Math.min(index + 1, total)} total={total} label={t('live.questionOf', { n: Math.min(index + 1, total), total })} />
            <CandidateStrip state={liveState} />
            <View style={styles.card}>
              {finished ? (
                <Button label={t('live.seeResult')} onPress={() => router.replace(LIVE_RESULT_ROUTE as never)} />
              ) : step.kind === 'movement' && phase === 'try' ? (
                <>
                  <AppText variant="h2" color={colors.navy}>
                    {localized(current.name)}
                  </AppText>
                  <AppText variant="body">{localized(current.instruction)}</AppText>
                  {current.cameraMeasurable ? (
                    <>
                      <Button variant="outline" icon="camera-outline" label={t('movement.camera')} onPress={() => setCameraNote(true)} />
                      {cameraNote ? (
                        <AppText variant="secondary" color={colors.muted}>
                          {t('movement.cameraNote')}
                        </AppText>
                      ) : null}
                    </>
                  ) : null}
                  <Button label={t('movement.tried')} onPress={() => setPhase('feel')} />
                  <Button variant="text" label={t('movement.skip')} onPress={skipMovement} />
                </>
              ) : step.kind === 'movement' ? (
                <>
                  <AppText variant="h2" color={colors.navy}>
                    {t('movement.feelTitle')}
                  </AppText>
                  <AppText variant="secondary" color={colors.muted}>
                    {t('movement.feelSub', { n: index + 1, name: localized(current.name) })}
                  </AppText>
                  <View style={styles.chips}>
                    {FEEL.map((f) => (
                      <AnswerChip key={f.key} label={t(f.label)} on={picked.has(f.key)} onPress={() => toggle(f.key)} />
                    ))}
                  </View>
                  {picked.size > 0 ? <Button label={t('live.done')} onPress={submitPicked} /> : null}
                  <Button variant="text" label={t('movement.skip')} onPress={skipMovement} />
                </>
              ) : question ? (
                <>
                  <AppText variant="h2" color={colors.navy}>
                    {question.text}
                  </AppText>
                  <View style={styles.chips}>
                    <AnswerChip label={t('answer.yes')} onPress={() => handle(submitQuestion(answered(question, true)))} />
                    <AnswerChip label={t('answer.no')} onPress={() => handle(submitQuestion(answered(question, false)))} />
                    <AnswerChip label={t('answer.notSure')} onPress={() => handle(submitQuestion(unknown(question)))} />
                  </View>
                  <Button variant="text" label={t('movement.skip')} onPress={() => handle(submitQuestion(unknown(question)))} />
                  <AppText variant="secondary" color={colors.muted}>
                    {t('live.reaskNote')}
                  </AppText>
                </>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </Screen>
    </SafeGuard>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  lower: { gap: 10, paddingTop: 10, paddingBottom: 16 },
  card: { gap: 10, padding: 14, borderRadius: radius.card, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: MIN_TAP, minWidth: MIN_TAP, paddingHorizontal: 16, borderRadius: 24, borderWidth: 2, borderColor: colors.fieldBorder, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { textAlign: 'center' },
});
