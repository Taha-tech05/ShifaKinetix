import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Problem, ServerScreen } from '../../server/ServerScreen';
import { useServer } from '../../server/connection';
import { savedAssessment } from '../../server/uploadAssessment';
import { isCleared, shownVerdict, verdictText } from '../../server/verdict';
import type { PatientReport } from '../../reports/validation';
import { useSession } from '../../store/session';
import { useTheme } from '../../ui/ThemeProvider';


const STATUS_VERDICT = { READY: 'SAFE', INCOMPLETE: 'CLARIFY', REFER: 'RED_FLAG' } as const;
const label = (id: string) => id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

type Loaded = { kind: 'loading' } | { kind: 'none' } | { kind: 'report'; report: PatientReport } | { kind: 'error'; message: string };

/**
 * The patient's report from the server. Muscles are listed only when the phone AND the server both gave SAFE; in every other case
 * (refer, incomplete, disagreement, error, timeout, unusable response) the screen says the result is not cleared. The patient
 * report holds no differential, condition name or score, and the client rejects a response that does.
 */
export default function ServerReport() {
  const { colors } = useTheme();
  const { status, identity, api } = useServer();
  const phone = useSession((s) => s.gateVerdict);
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const patient = status === 'connected' && identity?.role === 'patient' && api !== null;

  useEffect(() => {
    if (!patient) return;
    let active = true;
    savedAssessment()
      .then(async ({ intakeId }) => {
        if (!intakeId) return active && setLoaded({ kind: 'none' });
        const report = await api.patientReport(intakeId);
        if (active) setLoaded({ kind: 'report', report });
      })
      .catch((e: unknown) => {
        if (active) setLoaded({ kind: 'error', message: e instanceof Error ? e.message : 'The report could not be loaded.' });
      });
    return () => { active = false; };
  }, [patient, api, attempt]);

  if (!patient) {
    return (
      <ServerScreen title="Report from the server">
        <Card>
          <AppText variant="bodyStrong" color={colors.text}>
            {status === 'connected' ? 'A patient account is required for this screen.' : 'Not connected to the server.'}
          </AppText>
          <Button label="Server connection" onPress={() => router.replace('/server' as never)} />
        </Card>
      </ServerScreen>
    );
  }

  const report = loaded.kind === 'report' ? loaded.report : null;
  // No report means no server verdict: the shown verdict is then never cleared.
  const shown = shownVerdict(phone, report ? STATUS_VERDICT[report.status] : null);
  const cleared = report !== null && report.status === 'READY' && isCleared(shown);

  return (
    <ServerScreen title="Report from the server">
      {loaded.kind === 'loading' ? <AppText accessibilityRole="alert">Loading the report…</AppText> : null}
      {loaded.kind === 'none' ? (
        <Card>
          <AppText variant="bodyStrong" color={colors.text}>No saved assessment yet.</AppText>
          <AppText>Complete the safety questions and upload the assessment first.</AppText>
          <Button label="Sync status" onPress={() => router.replace('/server/sync' as never)} />
        </Card>
      ) : null}
      {loaded.kind === 'error' ? (
        <>
          <Problem text={`Report unavailable. ${loaded.message}`} />
          <Card>
            <AppText variant="bodyStrong" color={colors.text}>This is not a result and not a clearance.</AppText>
            <AppText>If you are unsure about your shoulder, please talk to a doctor.</AppText>
            <Button label="Try again" variant="outline" onPress={() => { setLoaded({ kind: 'loading' }); setAttempt((n) => n + 1); }} />
          </Card>
        </>
      ) : null}
      {report ? (
        <Card>
          <AppText accessibilityRole="alert" variant="bodyStrong" color={shown.verdict === 'RED_FLAG' ? colors.danger : colors.text}>
            {verdictText(shown)}
          </AppText>
          {report.status !== 'READY' ? <AppText>{report.message}</AppText> : null}
          {report.status === 'READY' && !cleared ? (
            <AppText>The phone and the server do not both agree that it is safe to continue, so no muscles are shown. Please talk to a doctor.</AppText>
          ) : null}
          {cleared ? (
            <>
              <AppText variant="bodyStrong" color={colors.text}>Muscles that may be involved</AppText>
              {report.musclesThatMayBeInvolved?.length
                ? report.musclesThatMayBeInvolved.map((m) => <AppText key={m}>{`• ${label(m)}`}</AppText>)
                : <AppText>No specific muscle stood out.</AppText>}
              {report.cluster ? <AppText variant="secondary" color={colors.muted}>Several muscles are close together here.</AppText> : null}
              <AppText variant="secondary" color={colors.muted}>{report.guidance}</AppText>
            </>
          ) : null}
          {shown.verdict === 'RED_FLAG' ? <Button label="Call 1122" icon="call-outline" onPress={() => Linking.openURL('tel:1122')} style={{ backgroundColor: colors.danger }} /> : null}
          <AppText variant="secondary" color={colors.muted}>{`${report.banner} Please talk to a doctor about your shoulder.`}</AppText>
          <Button label="Sync status" variant="outline" onPress={() => router.replace('/server/sync' as never)} />
        </Card>
      ) : null}
    </ServerScreen>
  );
}
