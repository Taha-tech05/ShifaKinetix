import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Page, styles } from '../components/SafetyUI';
import { authorizedReport, DoctorReport, DoctorReportAccess } from './doctorReport';

// Integration component, deliberately absent from the patient Router routes.
// C's endpoint must enforce doctor authorization; this client check is not security.
export function DoctorReportScreen({ access }: { access: DoctorReportAccess }) {
  const [loaded, setLoaded] = useState<{ access: DoctorReportAccess; report: DoctorReport } | null>(null);
  const [failure, setFailure] = useState<{ access: DoctorReportAccess; message: string } | null>(null);
  useEffect(() => {
    let active = true;
    void authorizedReport(access).then((report) => { if (active) { setLoaded({ access, report }); setFailure(null); } })
      .catch(() => { if (active) { setLoaded(null); setFailure({ access, message: 'Doctor report unavailable. Check your authorized session.' }); } });
    return () => { active = false; };
  }, [access]);
  // Prevent even a single render of the previous report after role/session changes.
  const report = access.role === 'doctor' && loaded?.access === access ? loaded.report : null;
  const error = failure?.access === access ? failure.message : '';
  return <Page>
    <Text style={styles.heading}>Doctor report</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {report ? <>
      <View style={styles.card}><Text style={styles.heading}>Recorded facts</Text>
        <Text style={styles.caption}>Intake: {report.intakeId}</Text>
        {report.facts.map((fact, i) => <Text key={i} style={styles.body}>{fact.label}: {fact.value}</Text>)}
        <Text style={styles.body}>Gate: {report.gate.verdict}</Text>
        {report.gate.firedRules.map((rule) => <View key={rule.ruleId}>
          <Text style={styles.body}>{rule.reason}</Text><Text style={styles.caption}>{rule.source}</Text>
        </View>)}
      </View>
      <View style={styles.card}><Text style={styles.heading}>Differential · draft</Text>
        <Text style={styles.caption}>For clinician review only. Order supplied by the server.</Text>
        {report.differential.length === 0 && <Text style={styles.body}>No differential supplied.</Text>}
        {report.differential.map((item, i) => <View key={i}>
          <Text style={styles.body}>{i + 1}. {item.condition}</Text>
          <Text style={styles.body}>{item.reason}</Text><Text style={styles.caption}>{item.source}</Text>
        </View>)}
      </View>
    </> : !error && <Text style={styles.body}>Checking doctor access…</Text>}
  </Page>;
}
