import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { muscleName } from '../../components/narrowing/CandidateStrip';
import type { TKey } from '../../i18n';
import { activeHistory, firstOpenStep, goBackDurable, seedLiveState, LIVE_RESULT_ROUTE, liveSteps, nextStepIndex, stepIndexOf, submitMovementDurable, submitQuestionDurable, totalSteps } from '../../flow/live';
import type { LiveOutcome } from '../../flow/live';
import { SafeGuard } from '../../flow/SafeGuard';
import { MOVEMENTS, localized, movementById } from '../../movement/movements';
import { buildMovementResult } from '../../movement/result';
import type { Feel } from '../../movement/result';
import { discriminatorQuestions } from '../../narrowing/bank';
import { structureQuestions } from '../../narrowing/structureBank';
import { answered, unknown } from '../../questions/answer';
import { sideOfRegion } from '../../regions/shoulder';
import { useSession } from '../../store/session';
import type { HistoryEntry } from '../../store/session';
import { useT } from '../../store/settings';
import { BotBubble, ChipRow } from '../../ui/chat';
import { Chip } from '../../ui/Chip';
import { SceneSheetContent, useSceneStep } from '../../ui/SceneSheetContent';
import { useScene } from '../../ui/scene';
import { useTheme } from '../../ui/ThemeProvider';

type Key = 'noPain' | 'pain' | 'weak' | 'couldNot' | 'unsure';
const FEEL: { key: Key; label: TKey }[] = [
  { key: 'noPain', label: 'movement.noPain' },
  { key: 'pain', label: 'movement.pain' },
  { key: 'weak', label: 'movement.weak' },
  { key: 'couldNot', label: 'movement.couldNot' },
  { key: 'unsure', label: 'answer.notSure' },
];

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
  // The body (and its seed of the possible muscles) is only created once the guard has confirmed the saved SAFE verdict.
  return (
    <SafeGuard>
      <LiveScreenBody />
    </SafeGuard>
  );
}

function LiveScreenBody() {
  const t = useT();
  const { colors } = useTheme();
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
  const [cameraNote, setCameraNote] = useState(false);
  const [lieDownOk, setLieDownOk] = useState('');
  const [lastMovement, setLastMovement] = useState(MOVEMENTS[0]);
  // true while an answer is being saved: further taps are ignored so one answer is never saved twice
  const saving = useRef(false);

  // opened from "Review answers": show that question again with the current answer selected
  useEffect(() => {
    if (reviewIndex < 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- opening a review link resets the screen to that question
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
  const current = step.kind === 'movement' ? movementById(step.id) ?? MOVEMENTS[0] : lastMovement;
  if (step.kind === 'movement' && lastMovement !== current) setLastMovement(current);
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
  const previous = useCallback(async () => {
    if (saving.current) return;
    saving.current = true;
    const r = await goBackDurable().finally(() => {
      saving.current = false;
    });
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
        void previous();
        return true;
      });
      return () => sub.remove();
    }, [previous]),
  );

  /** Saves the answer first (the result of `submit` is only used once the checkpoint has finished), then moves on. */
  const save = async (submit: () => Promise<LiveOutcome>) => {
    if (saving.current) return;
    saving.current = true;
    try {
      handle(await submit());
    } finally {
      saving.current = false;
    }
  };
  const answerMovement = (feel: Feel, label: string) => save(() => submitMovementDurable(buildMovementResult(current.id, feel), label));
  const skipMovement = () => void answerMovement({ kind: 'skip' }, 'skip');
  const toggle = (k: Key) => {
    if (k === 'unsure') return void answerMovement({ kind: 'unsure' }, 'unsure');
    if (k === 'noPain') return void answerMovement({ kind: 'felt', pain: false, weak: false, couldNot: false }, 'noPain');
    const next = new Set(picked);
    next.delete('noPain');
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setPicked(next);
  };
  const submitPicked = () => void answerMovement({ kind: 'felt', pain: picked.has('pain'), weak: picked.has('weak'), couldNot: picked.has('couldNot') }, [...picked].join('+'));
  const answerQuestion = (kind: 'yes' | 'no' | 'unsure') => {
    if (!question) return;
    void save(() => submitQuestionDurable(kind === 'yes' ? answered(question, true) : kind === 'no' ? answered(question, false) : unknown(question)));
  };
  const selected = (kind: 'yes' | 'no' | 'unsure') => {
    const a = prefill?.answer;
    if (!a) return false;
    return kind === 'unsure' ? a.state === 'unknown' : a.state === 'answered' && a.value === (kind === 'yes');
  };

  const asked = (liveState ? liveState.structure.asked + liveState.asked : 0) + 1;
  const n = Math.min(asked, total);
  // ---- presentation only: how the shared scene (3D body + sheet) should look for this step ----
  const lieDown = onMovement && needsLieDown(current.id) && lieDownOk !== current.id;
  const sceneMode = finished || step.kind !== 'movement' ? 'questions' : phase === 'try' ? 'moving' : 'feel';
  const stepKey = `${finished ? 'done' : step.kind}-${step.id}${reviewing ? '-review' : ''}`;
  const involved = useMemo(() => [...new Set((liveState?.candidates ?? []).map((c) => muscleName(c.muscleId)))].sort(), [liveState]);
  useSceneStep({
    stepKey,
    mode: lieDown ? 'questions' : sceneMode,
    instruction: onMovement && phase === 'try' && !lieDown ? localized(current.instruction) : null,
    progress: { label: t('scene.phaseMove', { n, total }), value: n / total },
    stage: { movement: current, side, paused: !onMovement || lieDown, highlightIds, autoFocus: !onMovement },
  });
  // the animation has played once: show the answers (the sheet opens by itself unless the patient has moved it)
  const played = useScene((st) => st.playedNonce);
  const baseline = useRef(played);
  useEffect(() => {
    baseline.current = useScene.getState().playedNonce;
  }, [stepKey]);
  useEffect(() => {
    if (played > baseline.current && onMovement && phase === 'try') setPhase('feel');
  }, [played]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mode) return <Redirect href="/report/fork" />;

  return (
    <SceneSheetContent contentKey={stepKey} ownIds={[step.id]} onBack={previous}>
      {finished ? (
        <>
          <BotBubble>{t('live.enough')}</BotBubble>
          {involved.length > 0 ? <InvolvedBubble names={involved} /> : null}
          <Button label={t('live.seeResult')} onPress={() => router.replace(LIVE_RESULT_ROUTE as never)} />
        </>
      ) : step.kind === 'movement' && lieDown ? (
        <>
          <BotBubble tone="caution">{t('scene.lieDown')}</BotBubble>
          <Button label={t('common.continue')} onPress={() => setLieDownOk(current.id)} />
        </>
      ) : step.kind === 'movement' && phase === 'try' ? (
        <>
          <BotBubble>
            <AppText variant="bodyStrong">{localized(current.name)}</AppText>
            <AppText variant="secondary">{localized(current.instruction)}</AppText>
            <AppText variant="secondary" color={colors.caution}>
              {t('moveSafely')}
            </AppText>
          </BotBubble>
          {current.cameraMeasurable ? (
            <ChipRow>
              <Chip label={cameraNote ? t('movement.cameraNote') : t('movement.camera')} onPress={() => setCameraNote(true)} />
            </ChipRow>
          ) : null}
          <ChipRow>
            <Chip large selected label={t('movement.tried')} onPress={() => setPhase('feel')} />
            <Chip large label={t('movement.skip')} onPress={skipMovement} />
          </ChipRow>
        </>
      ) : step.kind === 'movement' ? (
        <>
          <BotBubble>
            <AppText variant="bodyStrong">{localized(current.name)}</AppText>
            <AppText variant="secondary">{t('movement.feelTitle')}</AppText>
          </BotBubble>
          <ChipRow>
            {FEEL.map((f) => (
              <Chip key={f.key} large label={t(f.label)} selected={picked.has(f.key)} onPress={() => toggle(f.key)} />
            ))}
            <Chip large label={t('movement.skip')} onPress={skipMovement} />
          </ChipRow>
          {picked.size > 0 ? <Button label={t('live.done')} onPress={submitPicked} /> : null}
        </>
      ) : question ? (
        <>
          <BotBubble>{question.text}</BotBubble>
          <ChipRow>
            <Chip large label={t('answer.yes')} selected={selected('yes')} onPress={() => answerQuestion('yes')} />
            <Chip large label={t('answer.no')} selected={selected('no')} onPress={() => answerQuestion('no')} />
            <Chip large label={t('answer.notSure')} selected={selected('unsure')} onPress={() => answerQuestion('unsure')} />
            <Chip large label={t('movement.skip')} onPress={() => answerQuestion('unsure')} />
          </ChipRow>
          {involved.length > 0 ? <InvolvedBubble names={involved} /> : null}
        </>
      ) : null}
    </SceneSheetContent>
  );
}

/** The model highlights these. Names only, in alphabetical order: no scores, no ranking, no confidence. */
function InvolvedBubble({ names }: { names: string[] }) {
  const t = useT();
  return (
    <>
      <BotBubble>
        <AppText variant="bodyStrong">{t('scene.involved')}</AppText>
      </BotBubble>
      <ChipRow>
        <Chip tone="involved" icon="eye-outline" label={t('scene.mayBeInvolved')} />
        {names.map((nm) => (
          <Chip key={nm} tone="involved" label={nm} />
        ))}
      </ChipRow>
    </>
  );
}

/** A leg movement the patient should do lying down (none in the shoulder set yet). */
const needsLieDown = (id: string) => /straight.?leg/i.test(id);
