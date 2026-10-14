import { router } from 'expo-router';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { colors } from '../theme';
import { useServer } from './connection';
import { ServerScreen } from './ServerScreen';

/** The server connection when the SERVER says this is a doctor, else null. The app's own settings are never consulted. */
export function useDoctorApi() {
  const { status, identity, api } = useServer();
  return status === 'connected' && identity?.role === 'doctor' && api ? { api, identity } : null;
}

/** What every doctor screen shows to anyone else: nothing loads, nothing is requested. */
export function DoctorRequired({ title }: { title: string }) {
  const status = useServer((s) => s.status);
  return (
    <ServerScreen title={title}>
      <Card>
        <AppText variant="bodyStrong" color={colors.navy}>
          {status === 'connected' ? 'Doctor access required.' : 'Not connected to the server.'}
        </AppText>
        <AppText variant="secondary" color={colors.muted}>The server decides who is a doctor. Sign in with a doctor account.</AppText>
        <Button label="Server connection" onPress={() => router.replace('/server' as never)} />
      </Card>
    </ServerScreen>
  );
}
