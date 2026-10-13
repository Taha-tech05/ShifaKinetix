import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { ApiClient, ApiIdentity } from '../storage/apiClient';
import { openSafetySession } from './safetySession';
import { DoctorReportScreen } from '../reports/DoctorReportScreen';
import type { DoctorReportAccess } from '../reports/doctorReport';

const openIntakeStore = async () => (await import('../storage/nativeStore')).openIntakeStore();

/** Demo connection uses server-issued tokens; none are persisted or taken from the role picker. */
export function AssessmentSync() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(process.env.EXPO_PUBLIC_API_URL ?? '');
  const [token, setToken] = useState('');
  const [intake, setIntake] = useState('');
  const [connection, setConnection] = useState<{ api: ApiClient; user: ApiIdentity } | null>(null);
  const [report, setReport] = useState<DoctorReportAccess | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  function disconnect() {
    generation.current++; setConnection(null); setReport(null); setToken(''); setMessage(''); setBusy(false);
  }
  async function perform(work: (current: number) => Promise<void>) {
    if (busy) return;
    const current = ++generation.current;
    setBusy(true); setMessage(''); setReport(null);
    try { await work(current); }
    catch (error) { if (generation.current === current) setMessage(error instanceof Error ? error.message : 'Connection failed. Saved data is retained.'); }
    finally { if (generation.current === current) setBusy(false); }
  }
  if (!open) return <Button variant="outline" label="Saved assessment and sync" onPress={() => {
    setOpen(true);
    void perform(async (current) => {
      const session = await openSafetySession();
      const id = session.activeId ?? await (await openIntakeStore()).latestIntake();
      if (generation.current === current) setIntake(id ?? '');
    });
  }} />;
  return <View style={{ gap: 12 }}>
    <AppText variant="h1">Saved assessment</AppText>
    <AppText>Safety checks work offline. Upload uses your server account; failed uploads stay on this device.</AppText>
    {!connection && <>
      <AppText>Demo connection: use the API address and access token provided by the team. Tokens are kept only until you disconnect or restart the app.</AppText>
      <TextInput accessibilityLabel="API address" placeholder="https://your-demo-server" value={url} editable={!busy}
        autoCapitalize="none" autoCorrect={false} onChangeText={setUrl} />
      <TextInput accessibilityLabel="Access token" placeholder="Server-issued access token" value={token} editable={!busy}
        secureTextEntry autoCapitalize="none" autoCorrect={false} onChangeText={setToken} />
      <Button label="Connect" disabled={busy || !url.trim() || !token.trim()} onPress={() => void perform(async (current) => {
        const api = new ApiClient(url.trim(), token, fetch, typeof __DEV__ !== 'undefined' && __DEV__);
        const user = await api.identity();
        if (generation.current === current) { setConnection({ api, user }); setToken(''); }
      })} />
    </>}
    {connection && <>
      <AppText>Connected as {connection.user.id} ({connection.user.role})</AppText>
      {connection.user.role === 'doctor'
        ? <TextInput accessibilityLabel="Assessment ID" value={intake} editable={!busy}
          autoCapitalize="none" onChangeText={(value) => { setIntake(value); setReport(null); }} />
        : <AppText selectable>Assessment ID: {intake || 'Start or resume an assessment first.'}</AppText>}
      {connection.user.role === 'patient' && <Button label="Upload saved assessment" disabled={busy || !intake}
        onPress={() => void perform(async (current) => {
          const user = await connection.api.identity();
          if (user.role !== 'patient' || user.id !== connection.user.id) throw new Error('Sign in again with the assessment account.');
          const session = await openSafetySession();
          if (session.activeId === intake) await session.checkpoint();
          const store = await openIntakeStore();
          const result = await store.syncOrdered(intake, JSON.stringify([connection.api.baseUrl, user.id]), async (event) => {
            if (generation.current !== current) throw new Error('Upload stopped. Remaining data is retained.');
            await connection.api.send(event);
          });
          const gate = await connection.api.gate(intake);
          if (generation.current === current) setMessage(result.remaining
            ? `${result.sent} events uploaded. New changes remain saved; upload again.`
            : `Upload confirmed. Server safety result: ${gate.verdict}.`);
        })} />}
      {connection.user.role === 'doctor' && <Button label="Load doctor report" disabled={busy || !intake.trim()}
        onPress={() => setReport({ role: 'doctor', load: () => connection.api.doctorReport(intake.trim()) })} />}
      <Button label="Disconnect" variant="text" onPress={disconnect} />
    </>}
    {busy && <AppText>Checking saved data and server access...</AppText>}
    {!!message && <AppText accessibilityRole="alert">{message}</AppText>}
    {report && <DoctorReportScreen access={report} />}
    <Button variant="text" label="Close saved assessment" onPress={() => { disconnect(); setOpen(false); }} />
  </View>;
}
