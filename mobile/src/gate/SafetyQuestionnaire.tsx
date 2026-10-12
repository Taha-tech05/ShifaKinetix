import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { StepProgress } from '../components/StepProgress';
import { colors } from '../theme';
import { useSession } from '../store/session';
import { structuredGateInputs } from '../flow/gateInputs';
import { isValidAnswer, Question, questions, SafetyAnswer } from './evaluate';
import { safetyAnswersFrom } from './sessionAdapter';
import { openSafetySession } from './safetySession';
import { withMovementUncertainty } from './sessionEvaluator';

export function SafetyQuestionnaire({ clarify = false }: { clarify?: boolean }) {
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
    if (output.verdict === 'RED_FLAG') {
      setQuestion(null);
      const uncertaintyOnly = output.firedRules.every((r) => /^[MU]_/.test(r.ruleId));
      router.replace(uncertaintyOnly ? '/report/unclear' : '/report/urgent'); return;
    }
    const state = useSession.getState();
    const adapted = safetyAnswersFrom(withMovementUncertainty(
      [...state.answers, ...structuredGateInputs(state.answers, state.movementResults)], state.movementResults)) ?? [];
    const uncertain = questions.find((q) => q.required && adapted.some((a) => a.questionId === q.questionId && a.state === 'unknown'));
    const missing = questions.find((q) => !state.answers.some((a) => a.questionId === q.questionId));
    if (clarify && !uncertain) { router.replace(missing ? '/report/danger'
      : output.verdict === 'CLARIFY' ? '/report/unclear' : '/report/safe'); return; }
    if (!clarify && !missing) { router.replace(output.verdict === 'CLARIFY' ? '/report/reask' : '/report/safe'); return; }
    setQuestion(clarify ? uncertain! : missing!); setInput('');
  }, [clarify]);
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
      await load();
    });
  }
  const numeric = input.trim() && /^\d+(\.\d+)?$/.test(input.trim()) ? Number(input) : NaN;
  const validNumber = question && isValidAnswer({ questionId: question.questionId, type: question.type, value: numeric, state: 'answered' });
  return <Screen>
    <AppText variant="secondary" color={colors.caution}>draft, awaiting clinician review</AppText>
    {error ? <View><AppText accessibilityRole="alert" color={colors.danger}>{error}</AppText>
      <Button label="Retry" disabled={busy} onPress={() => { void perform(load); }} /></View> : null}
    {entry && <>
      <AppText variant="h1">Shoulder safety check</AppText>
      <AppText>Start a new assessment for new symptoms. Resume only to continue the same saved assessment.</AppText>
      <AppText>We check your earlier symptom answers first. A safety concern may pause this assessment before more questions or movement checks.</AppText>
      <Button label="Start new safety check" disabled={busy || !useSession.getState().selection}
        onPress={() => { void perform(async () => { await (await openSafetySession()).start(randomUUID()); await load(); }); }} />
      <Button label="Resume saved assessment" variant="outline" disabled={busy}
        onPress={() => { void perform(async () => { await (await openSafetySession()).resumeLatest(); await load(); }); }} />
      {!useSession.getState().selection && <Button label="Choose shoulder location" onPress={() => router.replace('/report/intro')} />}
    </>}
    {question && !entry && <>
      <StepProgress step={questions.indexOf(question) + 1} total={questions.length} label={clarify ? 'Please clarify once' : 'Safety questions'} />
      <AppText variant="h1">{question.wording}</AppText>
      {clarify && <AppText>{question.clarification}</AppText>}
      {question.type === 'yesno' && <>
        <Button label="Yes" disabled={busy || !!error} onPress={() => { void save(true); }} />
        <Button label="No" variant="outline" disabled={busy || !!error} onPress={() => { void save(false); }} />
      </>}
      {question.type === 'choice' && question.options?.map((o) => <Button key={o.value} label={o.label}
        disabled={busy || !!error} onPress={() => { void save(o.value); }} />)}
      {(question.type === 'number' || question.type === 'duration') && <>
        <AppText>{question.unit} ({question.min}–{question.max})</AppText>
        <TextInput accessibilityLabel={question.wording} keyboardType="decimal-pad" value={input} onChangeText={setInput}
          editable={!busy} style={{ borderWidth: 1, borderColor: colors.muted, borderRadius: 12, padding: 16, fontSize: 20 }} />
        <Button label="Save answer" disabled={busy || !!error || !validNumber} onPress={() => { void save(numeric); }} />
      </>}
      <Button label="Not sure" variant="outline" disabled={busy || !!error} onPress={() => { void save(null); }} />
      <AppText variant="secondary">Source: {question.source}</AppText>
    </>}
    {busy && <AppText>Checking saved answers…</AppText>}
  </Screen>;
}
