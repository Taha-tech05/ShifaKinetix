import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Problem, ServerScreen } from '../../server/ServerScreen';
import { useServer } from '../../server/connection';
import { radius, spacing } from '../../theme';
import { useMemo } from 'react';
import { useTheme } from '../../ui/ThemeProvider';
import type { Palette } from '../../ui/theme';

/** Connect to Person C's server. One tap signs in to a fixed demo account; the role shown is what the server reports. */
export default function ServerConnection() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { status, baseUrl, identity, error, signInDemo, connectWithToken, setBaseUrl, disconnect } = useServer();
  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState('');
  const busy = status === 'connecting';
  const connected = status === 'connected' && identity !== null;

  return (
    <ServerScreen title="Server connection">
      {connected ? (
        <Card>
          <AppText variant="bodyStrong" color={colors.text}>Connected</AppText>
          <AppText>{`Signed in as ${identity.id} (${identity.role}), confirmed by the server.`}</AppText>
          <AppText variant="secondary" color={colors.muted}>{baseUrl}</AppText>
          {identity.role === 'patient' ? (
            <>
              <Button label="Server report" onPress={() => router.push('/server/report' as never)} />
              <Button label="Sync status" variant="outline" onPress={() => router.push('/server/sync' as never)} />
            </>
          ) : (
            <Button label="Latest cases" onPress={() => router.push('/server/doctor' as never)} />
          )}
          <Button label="Disconnect" variant="text" onPress={disconnect} />
        </Card>
      ) : (
        <Card>
          <AppText variant="bodyStrong" color={colors.text}>Not connected</AppText>
          <AppText variant="secondary" color={colors.muted}>
            Safety checks work without a server. The server decides the role of each account.
          </AppText>
          <View style={styles.field}>
            <AppText variant="secondary" color={colors.text} style={styles.label}>API address</AppText>
            <TextInput accessibilityLabel="API address" value={baseUrl} onChangeText={setBaseUrl} placeholder="http://10.0.2.2:8000"
              editable={!busy} autoCapitalize="none" autoCorrect={false} style={styles.input} />
          </View>
          <Button label="Sign in as Patient" disabled={busy || !baseUrl.trim()} onPress={() => void signInDemo('patient')} />
          <Button label="Sign in as Doctor" variant="outline" disabled={busy || !baseUrl.trim()} onPress={() => void signInDemo('doctor')} />
          {busy ? <AppText accessibilityRole="alert">Contacting the server…</AppText> : null}
          <Button label={showToken ? 'Hide access token' : 'Use an access token instead'} variant="text" onPress={() => setShowToken((v) => !v)} />
          {showToken ? (
            <>
              <View style={styles.field}>
                <AppText variant="secondary" color={colors.text} style={styles.label}>Access token</AppText>
                <TextInput accessibilityLabel="Access token" value={token} onChangeText={setToken} placeholder="Server-issued access token"
                  editable={!busy} secureTextEntry autoCapitalize="none" autoCorrect={false} style={styles.input} />
              </View>
              <Button label="Connect with token" variant="outline" disabled={busy || !baseUrl.trim() || !token.trim()}
                onPress={() => void connectWithToken(baseUrl, token).then(() => setToken(''))} />
            </>
          ) : null}
        </Card>
      )}
      <Problem text={error} />
    </ServerScreen>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  field: { gap: 4 },
  label: { fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 2, borderColor: colors.lineStrong, borderRadius: radius.card, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
});
