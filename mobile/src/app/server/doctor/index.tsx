import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { DoctorRequired, useDoctorApi } from '../../../server/doctorAccess';
import { useServer } from '../../../server/connection';
import { ServerScreen } from '../../../server/ServerScreen';
import { colors, radius, spacing } from '../../../theme';

/** The server has no list of assessments, so a doctor looks one up by its ID (the patient's phone shows it on the sync screen). */
export default function DoctorLookup() {
  const doctor = useDoctorApi();
  const lookupId = useServer((s) => s.lookupId);
  const setLookupId = useServer((s) => s.setLookupId);
  const [value, setValue] = useState(lookupId);
  if (!doctor) return <DoctorRequired title="Assessment lookup" />;
  const id = value.trim();
  const open = (path: string) => { setLookupId(id); router.push(path as never); };
  return (
    <ServerScreen title="Assessment lookup">
      <Card>
        <AppText variant="secondary" color={colors.muted}>{`Signed in as ${doctor.identity.id} (doctor), confirmed by the server.`}</AppText>
        <AppText variant="bodyStrong" color={colors.navy}>Assessment ID</AppText>
        <TextInput accessibilityLabel="Assessment ID" value={value} onChangeText={setValue} placeholder="intake-…" autoCapitalize="none"
          autoCorrect={false} maxLength={200} style={styles.input} />
        <Button label="Doctor report" disabled={!id} onPress={() => open('/server/doctor/report')} />
        <Button label="Audit trail" variant="outline" disabled={!id} onPress={() => open('/server/doctor/audit')} />
        <AppText variant="secondary" color={colors.muted}>Every view is recorded on the server in the audit trail.</AppText>
      </Card>
    </ServerScreen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 48, borderWidth: 2, borderColor: colors.fieldBorder, borderRadius: radius.card, paddingHorizontal: spacing.md, backgroundColor: colors.white },
});
