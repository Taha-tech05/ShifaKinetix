import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { loadCases } from '../../../server/cases';
import type { CaseRow } from '../../../server/cases';
import { DoctorRequired, useDoctorApi } from '../../../server/doctorAccess';
import { useServer } from '../../../server/connection';
import { Problem, ServerScreen } from '../../../server/ServerScreen';
import { colors, radius, spacing } from '../../../theme';

const CHIP = {
  RED_FLAG: { text: 'Urgent', color: colors.danger },
  CLARIFY: { text: 'Not sure', color: colors.caution },
  SAFE: { text: 'Safe', color: colors.safe },
  NONE: { text: 'Could not load', color: colors.danger },
} as const;

/** Latest cases, urgent first, each judged by the server's gate. Tap one to open its doctor report. */
export default function DoctorCases() {
  const doctor = useDoctorApi();
  const recent = useServer((s) => s.recentIntakeIds);
  const setLookupId = useServer((s) => s.setLookupId);
  const [state, setState] = useState<{ rows?: CaseRow[]; error?: string }>({});
  const [attempt, setAttempt] = useState(0);
  const api = doctor?.api;

  useEffect(() => {
    if (!api) return;
    let active = true;
    loadCases(api, recent)
      .then((rows) => { if (active) setState({ rows }); })
      .catch((e: unknown) => { if (active) setState({ error: e instanceof Error ? e.message : 'The cases could not be loaded.' }); });
    return () => { active = false; };
  }, [api, recent, attempt]);

  if (!doctor) return <DoctorRequired title="Latest cases" />;
  const rows = state.rows;
  const everyCaseFailed = rows !== undefined && rows.length > 0 && rows.every((r) => r.verdict === null);
  return (
    <ServerScreen title="Latest cases">
      <AppText variant="secondary" color={colors.muted}>
        {`Signed in as ${doctor.identity.id} (doctor), confirmed by the server. Urgent cases come first. Draft, awaiting clinician review.`}
      </AppText>
      {!rows && !state.error ? <AppText accessibilityRole="alert">Loading the cases…</AppText> : null}
      <Problem text={state.error ? `Cases unavailable. ${state.error}` : ''} />
      {everyCaseFailed ? (
        <Problem text="None of the cases could be loaded from the server. This is not a result: check the connection, or run the seed script (python -m app.seed_cases)." />
      ) : null}
      {rows?.map((c) => {
        const chip = CHIP[c.verdict ?? 'NONE'];
        return (
          <Card key={c.id} accessibilityLabel={`${chip.text}: ${c.label}`} onPress={() => { setLookupId(c.id); router.push('/server/doctor/report' as never); }}>
            <View style={styles.row}>
              <AppText variant="bodyStrong" color={chip.color}>{chip.text}</AppText>
              <AppText variant="secondary" color={colors.muted}>Open report</AppText>
            </View>
            <AppText variant="bodyStrong" color={colors.navy}>{c.label}</AppText>
            <AppText variant="secondary" color={colors.muted}>{c.id}</AppText>
          </Card>
        );
      })}
      <Button label="Refresh" variant="outline" onPress={() => { setState({}); setAttempt((n) => n + 1); }} />
      <AppText variant="secondary" color={colors.muted}>
        The server cannot list all assessments yet, so this shows the demo cases and anything uploaded from this phone. Each refresh is recorded in the server audit trail.
      </AppText>
    </ServerScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 0, borderRadius: radius.card, gap: spacing.sm },
});
