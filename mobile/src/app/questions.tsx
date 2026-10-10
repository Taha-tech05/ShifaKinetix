import { useCallback, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Action, Page, styles } from '../components/SafetyUI';
import { Answer, isValidAnswer, Question } from '../gate/evaluate';
import { openIntakeStore } from '../storage/nativeStore';

function QuestionInput({ question, busy, save }: { question: Question; busy: boolean; save: (value: Answer['value']) => void }) {
  const [input, setInput] = useState('');
  const numeric = input.trim() !== '' && /^\d+(\.\d+)?$/.test(input.trim()) ? Number(input) : NaN;
  const valid = isValidAnswer({ questionId: question.questionId, type: question.type, value: numeric, state: 'answered' });
  return <View style={{ gap: 12 }}>
    {question.type === 'yesno' && <><Action title="Yes" disabled={busy} onPress={() => save(true)} />
      <Action title="No" disabled={busy} secondary onPress={() => save(false)} /></>}
    {question.type === 'choice' && question.options?.map((option) => <Action key={option.value} title={option.label}
      disabled={busy} onPress={() => save(option.value)} />)}
    {(question.type === 'number' || question.type === 'duration') && <>
      <Text style={styles.caption}>{question.unit} · {question.min} to {question.max}</Text>
      <TextInput accessibilityLabel={question.wording} value={input} onChangeText={setInput}
        keyboardType="decimal-pad" editable={!busy} style={styles.input} placeholder="Enter a number" />
      <Action title="Save answer" disabled={busy || !valid} onPress={() => save(numeric)} />
    </>}
    <Action title="Not sure" disabled={busy} secondary onPress={() => save(null)} />
  </View>;
}

export default function QuestionScreen() {
  const params = useLocalSearchParams<{ intakeId?: string | string[] }>();
  const id = typeof params.intakeId === 'string' ? params.intakeId : '';
  const [question, setQuestion] = useState<Question | null>(null);
  const [position, setPosition] = useState(0);
  const [count, setCount] = useState(0);
  const [clarifying, setClarifying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const load = useCallback(async () => {
    const store = await openIntakeStore();
    const gate = await store.savedGate(id);
    if (gate.verdict === 'RED_FLAG') {
      router.replace({ pathname: '/result', params: { intakeId: id } }); return;
    }
    const bank = await store.cachedQuestions();
    const answers = await store.answers(id);
    const unknown = bank.find((q) => q.required && answers.some((a) => a.questionId === q.questionId && a.state === 'unknown'));
    const next = unknown ?? bank.find((q) => !answers.some((a) => a.questionId === q.questionId));
    if (!next) { router.replace({ pathname: '/result', params: { intakeId: id } }); return; }
    setCount(bank.length); setPosition(bank.indexOf(next) + 1); setQuestion(next); setClarifying(!!unknown);
  }, [id]);
  useFocusEffect(useCallback(() => {
    setQuestion(null); setError('');
    void load().catch(() => setError('Could not read the saved safety answers. Restart the app or seek clinical help.'));
  }, [load]));
  async function save(value: Answer['value']) {
    if (!question || saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const store = await openIntakeStore();
      await store.saveAnswer(id, { questionId: question.questionId, type: question.type as Answer['type'], value,
        state: value === null ? 'unknown' : 'answered', clarificationAttempted: clarifying });
      await load();
    } catch { setError('The saved answer could not be confirmed. Retry before continuing.'); }
    finally { saving.current = false; setBusy(false); }
  }
  return <Page>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {question ? <>
      <Text style={styles.caption}>Question {position} of {count}{question.required ? ' · Safety check' : ' · Additional context'}</Text>
      <Text style={styles.heading}>{question.wording}</Text>
      {clarifying && <View style={styles.card}><Text style={styles.body}>{question.clarification}</Text>
        <Text style={styles.caption}>If it is still unclear, we will direct you to a clinician.</Text></View>}
      <QuestionInput key={`${question.questionId}-${clarifying}`} question={question} busy={busy}
        save={(value) => { void save(value); }} />
      <Text style={styles.caption}>Source: {question.source}</Text>
    </> : !error && <Text style={styles.body}>Loading saved intake…</Text>}
  </Page>;
}
