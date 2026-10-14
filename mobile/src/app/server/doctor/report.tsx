import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { Button } from '../../../components/Button';
import { DoctorReportScreen } from '../../../reports/DoctorReportScreen';
import type { DoctorReportAccess } from '../../../reports/doctorReport';
import { DoctorRequired, useDoctorApi } from '../../../server/doctorAccess';
import { useServer } from '../../../server/connection';
import { colors, spacing } from '../../../theme';

/** The existing DoctorReportScreen, fed by the server's doctor-report endpoint with the role the SERVER reported. */
export default function DoctorReportRoute() {
  const doctor = useDoctorApi();
  const id = useServer((s) => s.lookupId);
  const api = doctor?.api;
  const role = doctor?.identity.role;
  // DoctorReportScreen reloads whenever `access` changes, so it must stay the same object between renders.
  const access = useMemo<DoctorReportAccess | null>(
    () => (api && role && id ? { role, load: () => api.doctorReport(id) } : null),
    [api, role, id],
  );
  if (!doctor || !access) return <DoctorRequired title="Doctor report" />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={{ padding: spacing.md }}>
        <Button label="Back to lookup" variant="outline" onPress={() => router.back()} />
      </View>
      <DoctorReportScreen access={access} />
    </View>
  );
}
