import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Problem, ServerScreen } from '../../server/ServerScreen';
import { useServer } from '../../server/connection';
import { savedAssessment, uploadSavedAssessment } from '../../server/uploadAssessment';
import type { UploadResult } from '../../server/uploadAssessment';
import { shownVerdict, verdictText } from '../../server/verdict';
import { useSession } from '../../store/session';
import { colors } from '../../theme';

/** Sync status and upload for the patient. The role check uses what the server reported when the person signed in. */
export default function ServerSync() {
  const { status, identity, api } = useServer();
  const phone = useSession((s) => s.gateVerdict);
  const [info, setInfo] = useState<{ intakeId: string | null; pending: number } | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const patient = status === 'connected' && identity?.role === 'patient' && api !== null;

  const refresh = async () => {
    try { setInfo(await savedAssessment()); } catch { setInfo(null); setError('The saved assessment could not be read on this phone.'); }
  };
  useEffect(() => {
    if (patient) void refresh();
    return () => { generation.current++; };
  }, [patient, api]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!patient) {
    return (
      <ServerScreen title="Sync status">
        <Card>
          <AppText variant="bodyStrong" color={colors.navy}>
            {status === 'connected' ? 'A patient account is required for this screen.' : 'Not connected to the server.'}
          </AppText>
          <Button label="Server connection" onPress={() => router.replace('/server' as never)} />
        </Card>
      </ServerScreen>
    );
  }

  const upload = async () => {
    if (busy || !info?.intakeId) return;
    const current = ++generation.current;
    setBusy(true); setError(''); setResult(null);
    try {
      const done = await uploadSavedAssessment(api, identity, info.intakeId, () => generation.current === current);
      if (generation.current === current) setResult(done);
    } catch (e) {
      if (generation.current === current) setError(e instanceof Error ? e.message : 'Upload failed. Saved data is retained.');
    } finally {
      if (generation.current === current) { setBusy(false); await refresh(); }
    }
  };

  // The server verdict counts only after a complete upload; a partial or failed upload leaves it unconfirmed.
  const serverVerdict = result && result.remaining === 0 ? result.serverVerdict : null;
  const shown = shownVerdict(phone, serverVerdict);
  return (
    <ServerScreen title="Sync status">
      <Card>
        <AppText variant="bodyStrong" color={colors.navy}>This phone</AppText>
        <AppText>{info?.intakeId ? `Assessment ${info.intakeId}` : 'No saved assessment yet. Complete the safety questions first.'}</AppText>
        <AppText variant="secondary" color={colors.muted}>{info ? `${info.pending} saved event(s) waiting to upload` : 'Checking saved data…'}</AppText>
        <AppText variant="secondary" color={colors.muted}>{`Signed in as ${identity.id}, confirmed by the server.`}</AppText>
        <Button label={busy ? 'Uploading…' : 'Upload saved assessment'} disabled={busy || !info?.intakeId} onPress={() => void upload()} />
      </Card>
      <Card>
        <AppText variant="bodyStrong" color={colors.navy}>Safety result</AppText>
        <AppText accessibilityRole="alert" color={shown.verdict === 'RED_FLAG' ? colors.danger : colors.navy}>{verdictText(shown)}</AppText>
        <AppText variant="secondary" color={colors.muted}>{`Phone: ${phone ?? 'not checked'}. Server: ${serverVerdict ?? 'not confirmed'}.`}</AppText>
        {result && result.remaining > 0 ? (
          <AppText variant="secondary" color={colors.caution}>{`${result.sent} uploaded, ${result.remaining} still waiting. Upload again.`}</AppText>
        ) : null}
        {result && result.remaining === 0 ? <AppText variant="secondary" color={colors.muted}>{`Upload confirmed by the server (${result.sent} new event(s)).`}</AppText> : null}
        <Button label="Server report" variant="outline" onPress={() => router.push('/server/report' as never)} />
      </Card>
      <Problem text={error} />
    </ServerScreen>
  );
}
