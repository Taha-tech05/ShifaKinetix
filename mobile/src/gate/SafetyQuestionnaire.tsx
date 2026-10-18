import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { useT } from '../store/settings';
import { BotBubble, ChipRow } from '../ui/chat';
import { Chip } from '../ui/Chip';
import { SceneSheetContent, useSceneStep } from '../ui/SceneSheetContent';
import { useTheme } from '../ui/ThemeProvider';
import { useSession } from '../store/session';
import { structuredGateInputs } from '../flow/gateInputs';
import { isRequiredQuestion, isValidAnswer, Question, questions, SafetyAnswer } from './evaluate';
import { pendingSafetyFollowups, safetyAnswersFrom } from './sessionAdapter';
import { questionHelp } from './questionHelp';
import { openSafetySession } from './safetySession';
import { withMovementUncertainty } from './sessionEvaluator';
import { AssessmentSync } from './AssessmentSync';

export function SafetyQuestionnaire({ clarify = false }: { clarify?: boolean }) {
  const { colors } = useTheme();
  const t = useT();
  const { review } = useLocalSearchParams<{ review?: string }>();
  const reviewed = useRef<string | undefined>(undefined);
  const [followingUp, setFollowingUp] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [entry, setEntry] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const locked = useRef(false);
  const load = useCallback(async () => {
    const session = await openSafetySession();
    if (!session.activeId) { setEntry(true); setQuestion(null); return; }
    setEntry(false);
    const output = await session.checkpoint();
    const requested = questions.find((q) => q.questionId === review);
    if (requested && reviewed.current !== review) {
      setQuestion(requested); setFollowingUp(true); setInput(''); return;
    }
    if (output.verdict === 'RED_FLAG') {
      setQuestion(null);
      const uncertaintyOnly = output.firedRules.every((r) => /^[MU]_/.test(r.ruleId));
      router.replace(uncertaintyOnly ? '/report/unclear' : '/report/urgent'); return;
    }
    const state = useSession.getState();
    const input = withMovementUncertainty(
      [...state.answers, ...structuredGateInputs(state.answers, state.movementResults)], state.movementResults);
    const adapted = safetyAnswersFrom(input) ?? [];
    if (output.verdict === 'CLARIFY' && adapted.some((a) => a.state === 'unknown'
      && a.clarificationAttempted && questions.some((q) => q.questionId === a.questionId && isRequiredQuestion(q, adapted)))) {
      setQuestion(null); router.replace('/report/unclear'); return;
    }
    const uncertain = questions.find((q) => isRequiredQuestion(q, adapted) && adapted.some((a) => a.questionId === q.questionId && a.state === 'unknown'));
    const missing = questions.find((q) => !state.answers.some((a) => a.questionId === q.questionId));
    if (clarify && !uncertain) { router.replace(missing ? '/report/danger'
      : output.verdict === 'CLARIFY' ? '/report/unclear' : '/report/safe'); return; }
    if (!clarify && !missing) { router.replace(output.verdict === 'CLARIFY' ? '/report/reask' : '/report/safe'); return; }
    const next = clarify ? uncertain! : missing!;
    setFollowingUp(pendingSafetyFollowups(input).includes(next.questionId));
    setQuestion(next); setInput('');
  }, [clarify, review]);
  async function perform(work: () => Promise<unknown>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await work(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not confirm your saved answers. Please retry.'); }
    finally { locked.current = false; setBusy(false); }
  }
  useEffect(() => {
    let active = true;
    void openSafetySession().then(load).catch((e: unknown) => {
      if (active) setError(e instanceof Error ? e.message : 'Could not read saved answers.');
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [load]);

  async function save(value: SafetyAnswer['value']) {
    if (!question) return;
    await perform(async () => {
      const session = await openSafetySession();
      await session.save({ questionId: question.questionId, type: question.type as SafetyAnswer['type'],
        value, state: value === null ? 'unknown' : 'answered', clarificationAttempted: clarify });
      reviewed.current = review;
      await load();
    });
  }
  const numeric = input.trim() && /^\d+(\.\d+)?$/.test(input.trim()) ? Number(input) : NaN;
  const validNumber = question && isValidAnswer({ questionId: question.questionId, type: question.type, value: numeric, state: 'answered' });
  useSceneStep({ stepKey: `safety-${clarify ? 'clarify-' : ''}${question?.questionId ?? (entry ? 'entry' : 'wait')}`, mode: 'questions',
    progress: question ? { label: t('scene.phaseSafety', { n: questions.indexOf(question) + 1, total: questions.length }), value: (questions.indexOf(question) + 1) / questions.length }
      : { label: t('scene.phaseSafety', { n: 1, total: questions.length }), value: 0.05 } });
  // the stepper nudges the same text the field shows; it never saves by itself
  const nudge = (delta: number) => {
    if (!question) return;
    const base = Number.isFinite(numeric) ? numeric : (question.min ?? 0);
    const next = Math.min(question.max ?? Number.MAX_SAFE_INTEGER, Math.max(question.min ?? 0, base + delta));
    setInput(String(next));
  };
  const off = busy || !!error;
  return <SceneSheetContent contentKey={`safety-${clarify ? 'clarify-' : ''}${question?.questionId ?? (entry ? 'entry' : 'wait')}`}
    ownIds={question ? [question.questionId] : []} onBack={() => router.back()}>
    <AssessmentSync />
    <AppText variant="secondary" color={colors.caution}>draft, awaiting clinician review</AppText>
    {error ? <View><AppText accessibilityRole="alert" color={colors.caution}>{'⚠ '}{error}</AppText>
      <Button label="Retry" disabled={busy} onPress={() => { void perform(load); }} /></View> : null}
    {entry && <>
      <BotBubble><AppText variant="h3">Shoulder safety check</AppText>
        <AppText>Start a new assessment for new symptoms. Resume only to continue the same saved assessment.</AppText>
        <AppText>We will clarify your earlier symptom answers. Confirmed warning symptoms pause movement checks; other answers can continue to the assessment.</AppText></BotBubble>
      <Button label="Start new safety check" disabled={busy || !useSession.getState().selection}
        onPress={() => { void perform(async () => { await (await openSafetySession()).start(randomUUID()); await load(); }); }} />
      <Button label="Resume saved assessment" variant="outline" disabled={busy}
        onPress={() => { void perform(async () => { await (await openSafetySession()).resumeLatest(); await load(); }); }} />
      {!useSession.getState().selection && <Button label="Choose shoulder location" onPress={() => router.replace('/report/intro')} />}
    </>}
    {question && !entry && <>
      <BotBubble>
        <AppText variant="bodyStrong">{question.wording}</AppText>
        {followingUp && <AppText variant="secondary" color={colors.muted}>An earlier answer needs a more specific safety check. Your answer here will clarify or correct it; the earlier response stays in this assessment.</AppText>}
        {questionHelp[question.questionId] && <AppText variant="secondary" color={colors.muted}>{questionHelp[question.questionId]}</AppText>}
        <AppText variant="secondary" color={colors.muted}>Yes means this symptom applies. No means it does not. Not sure lets us clarify; there is no preferred answer.</AppText>
        {clarify && <AppText variant="secondary" color={colors.muted}>{question.clarification}</AppText>}
      </BotBubble>
      {question.type === 'yesno' && <ChipRow>
        <Chip large label="Yes" disabled={off} onPress={() => { void save(true); }} />
        <Chip large label="No" disabled={off} onPress={() => { void save(false); }} />
      </ChipRow>}
      {question.type === 'choice' && <ChipRow>{question.options?.map((o) => <Chip large key={o.value} label={o.label}
        disabled={off} onPress={() => { void save(o.value); }} />)}</ChipRow>}
      {(question.type === 'number' || question.type === 'duration') && <>
        <AppText>{question.unit} ({question.min}–{question.max})</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Chip label="−" disabled={off} onPress={() => nudge(-1)} style={{ minWidth: 52, paddingHorizontal: 0 }} />
          <TextInput accessibilityLabel={question.wording} keyboardType="decimal-pad" value={input} onChangeText={setInput}
            editable={!busy} placeholderTextColor={colors.muted}
            style={{ flex: 1, borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: 20, padding: 14, fontSize: 20, color: colors.text, backgroundColor: colors.surface }} />
          <Chip label="+" disabled={off} onPress={() => nudge(1)} style={{ minWidth: 52, paddingHorizontal: 0 }} />
        </View>
        <Button label="Save answer" disabled={busy || !!error || !validNumber} onPress={() => { void save(numeric); }} />
      </>}
      <ChipRow><Chip large label="Not sure" disabled={off} onPress={() => { void save(null); }} /></ChipRow>
      <AppText variant="secondary" color={colors.muted}>Source: {question.source}</AppText>
    </>}
    {busy && <AppText color={colors.muted}>Checking saved answers…</AppText>}
  </SceneSheetContent>;
}
