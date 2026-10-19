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
import { Answer, isValidAnswer, Question, questions, SafetyAnswer } from './evaluate';
import { followUpPrompt, questionHelp } from './questionHelp';
import { nextSafetyStep, safetyProgress } from './safetyFlow';
import { openSafetySession } from './safetySession';
import { withMovementUncertainty } from './sessionEvaluator';
import { AssessmentSync } from './AssessmentSync';

type Reason = 'new' | 'clarify' | 'followup' | 'review';
const MAX_PREFILLS = questions.length;

function sessionInput(): Answer[] {
  const state = useSession.getState();
  return withMovementUncertainty([...state.answers, ...structuredGateInputs(state.answers, state.movementResults)], state.movementResults);
}

/**
 * The linked safety check (contract v2): two emergency questions, then one opening question per topic, and detail questions
 * only where an answer calls for them. An answer the patient already gave earlier (how it started, the pain score) is saved
 * from there, never asked again. A first "Not sure" on a hard-stop question shows its explanation on the same card; a
 * second one is saved. A follow-up appears only for a real contradiction and says what it is checking.
 */
export function SafetyQuestionnaire({ clarify = false }: { clarify?: boolean }) {
  const { colors } = useTheme();
  const t = useT();
  const { review } = useLocalSearchParams<{ review?: string }>();
  const reviewed = useRef<string | undefined>(undefined);
  const [reason, setReason] = useState<Reason>('new');
  const [question, setQuestion] = useState<Question | null>(null);
  // after a first "Not sure" on a hard-stop question: its simpler, concrete question is shown instead
  const [fallback, setFallback] = useState(false);
  const [prefilled, setPrefilled] = useState<string[]>([]);
  const [entry, setEntry] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const locked = useRef(false);
  const load = useCallback(async () => {
    const session = await openSafetySession();
    if (!session.activeId) { setEntry(true); setQuestion(null); return; }
    setEntry(false);
    let output = await session.checkpoint();
    const requested = questions.find((q) => q.questionId === review);
    if (requested && reviewed.current !== review) {
      setQuestion(requested); setReason('review'); setFallback(false); setInput(''); return;
    }
    const filled: string[] = [];
    for (let i = 0; i <= MAX_PREFILLS; i += 1) {
      const step = nextSafetyStep(sessionInput(), output);
      if (step.kind === 'prefill') {
        // Already answered earlier in the app: save it from there instead of asking again.
        output = await session.save(step.answer);
        filled.push(step.answer.questionId);
        continue;
      }
      if (filled.length) setPrefilled((p) => [...new Set([...p, ...filled])]);
      if (step.kind === 'route') { setQuestion(null); router.replace(step.to); return; }
      setQuestion(step.question); setReason(step.reason); setInput('');
      setFallback(step.reason === 'clarify' && !!step.question.fallback);
      return;
    }
    throw new Error('Could not confirm your saved answers. Please retry.');
  }, [review]);
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
  }, [load, clarify]); // the re-ask route reuses this screen: switching to it loads again

  async function save(value: SafetyAnswer['value']) {
    if (!question) return;
    await perform(async () => {
      const session = await openSafetySession();
      await session.save({ questionId: question.questionId, type: question.type as SafetyAnswer['type'],
        value, state: value === null ? 'unknown' : 'answered', clarificationAttempted: value === null && (fallback || reason === 'clarify' || clarify) });
      reviewed.current = review;
      await load();
    });
  }
  function notSure() {
    // A hard-stop question first offers its simpler, concrete question; only a "Not sure" to that is saved as unresolved.
    if (question?.tier === 'hardStop' && question.fallback && !fallback && reason !== 'followup') { setFallback(true); return; }
    void save(null);
  }
  const numeric = input.trim() && /^\d+(\.\d+)?$/.test(input.trim()) ? Number(input) : NaN;
  const validNumber = question && isValidAnswer({ questionId: question.questionId, type: question.type, value: numeric, state: 'answered' });
  const progress = question ? safetyProgress(sessionInput(), question) : { n: 1, total: questions.filter((q) => q.required).length };
  const key = `safety-${clarify ? 'clarify-' : ''}${question?.questionId ?? (entry ? 'entry' : 'wait')}`;
  useSceneStep({ stepKey: key, mode: 'questions',
    progress: { label: t('scene.phaseSafety', { n: progress.n, total: progress.total }), value: question ? progress.n / progress.total : 0.05 } });
  // the stepper nudges the same text the field shows; it never saves by itself
  const nudge = (delta: number) => {
    if (!question) return;
    const base = Number.isFinite(numeric) ? numeric : (question.min ?? 0);
    const next = Math.min(question.max ?? Number.MAX_SAFE_INTEGER, Math.max(question.min ?? 0, base + delta));
    setInput(String(next));
  };
  const off = busy || !!error;
  const prompt = question && reason === 'followup' ? followUpPrompt(question, sessionInput()) : null;
  const prefilledNames = prefilled.map((id) => questions.find((q) => q.questionId === id)?.wording).filter(Boolean);
  return <SceneSheetContent contentKey={key} ownIds={question ? [question.questionId] : []} onBack={() => router.back()}>
    <AssessmentSync />
    <AppText variant="secondary" color={colors.caution}>draft, awaiting clinician review</AppText>
    {error ? <View><AppText accessibilityRole="alert" color={colors.caution}>{'⚠ '}{error}</AppText>
      <Button label="Retry" disabled={busy} onPress={() => { void perform(load); }} /></View> : null}
    {entry && <>
      <BotBubble><AppText variant="h3">Shoulder safety check</AppText>
        <AppText>Start a new assessment for new symptoms. Resume only to continue the same saved assessment.</AppText>
        <AppText>A few quick questions check for warning signs. We only ask more about a topic when your answer calls for it.</AppText></BotBubble>
      <Button label="Start new safety check" disabled={busy || !useSession.getState().selection}
        onPress={() => { void perform(async () => { await (await openSafetySession()).start(randomUUID()); await load(); }); }} />
      <Button label="Resume saved assessment" variant="outline" disabled={busy}
        onPress={() => { void perform(async () => { await (await openSafetySession()).resumeLatest(); await load(); }); }} />
      {!useSession.getState().selection && <Button label="Choose shoulder location" onPress={() => router.replace('/report/intro')} />}
    </>}
    {question && !entry && <>
      {prefilledNames.length > 0 && <AppText variant="secondary" color={colors.muted}>
        Already answered earlier, so not asked again: {prefilledNames.join(' · ')}. You can change them in your answers.
      </AppText>}
      <BotBubble>
        {fallback && question.fallback ? <>
          <AppText variant="secondary" color={colors.muted}>That is fine. Let us try a simpler way.</AppText>
          <AppText variant="bodyStrong">{question.fallback.wording}</AppText>
        </> : <AppText variant="bodyStrong">{prompt?.text ?? question.wording}</AppText>}
        {reason === 'review' && <AppText variant="secondary" color={colors.muted}>Change your answer if it was not right. Everything is worked out again.</AppText>}
        {questionHelp[question.questionId] && !prompt?.choices && !fallback && <AppText variant="secondary" color={colors.muted}>{questionHelp[question.questionId]}</AppText>}
        {fallback && <AppText variant="secondary" color={colors.muted}>If you still cannot tell, choose Not sure. We will suggest that a doctor checks this with you.</AppText>}
      </BotBubble>
      {fallback && question.fallback ? <ChipRow>{question.fallback.options.map((o) => <Chip large key={o.label} label={o.label}
        disabled={off} onPress={() => { void save(o.value); }} />)}</ChipRow> : <>
      {question.type === 'yesno' && <ChipRow>
        {(prompt?.choices ?? [{ label: 'Yes', value: true }, { label: 'No', value: false }]).map((c) =>
          <Chip large key={c.label} label={c.label} disabled={off} onPress={() => { void save(c.value); }} />)}
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
      </>}
      <ChipRow><Chip large label="Not sure" disabled={off} onPress={notSure} /></ChipRow>
      <AppText variant="secondary" color={colors.muted}>Source: {question.source}</AppText>
    </>}
    {busy && <AppText color={colors.muted}>Checking saved answers…</AppText>}
  </SceneSheetContent>;
}
