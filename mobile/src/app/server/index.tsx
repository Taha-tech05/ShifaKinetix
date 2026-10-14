import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Problem, ServerScreen } from '../../server/ServerScreen';
import { useServer } from '../../server/connection';
import { colors, radius, spacing } from '../../theme';

/** Connect to Person C's server and sign in. The role shown here is what the server reports, not what was picked. */
export default function ServerConnection() {
  const { status, baseUrl, identity, error, signInDev, connectWithToken, disconnect } = useServer();
  const [url, setUrl] = useState(baseUrl);
  const [userId, setUserId] = useState('demo-patient');
  const [token, setToken] = useState('');
  const busy = status === 'connecting';
  const connected = status === 'connected' && identity !== null;

  return (
    <ServerScreen title="Server connection">
      {connected ? (
        <Card>
          <AppText variant="bodyStrong" color={colors.navy}>Connected</AppText>
          <AppText>{`Signed in as ${identity.id} (${identity.role}), confirmed by the server.`}</AppText>
          <AppText variant="secondary" color={colors.muted}>{baseUrl}</AppText>
          {identity.role === 'patient' ? (
            <>
              <Button label="Upload saved assessment" onPress={() => router.push('/server/sync' as never)} />
              <Button label="Server report" variant="outline" onPress={() => router.push('/server/report' as never)} />
            </>
          ) : (
            <Button label="Look up an assessment" onPress={() => router.push('/server/doctor' as never)} />
          )}
          <Button label="Disconnect" variant="text" onPress={disconnect} />
        </Card>
      ) : (
        <Card>
          <AppText variant="bodyStrong" color={colors.navy}>Not connected</AppText>
          <AppText variant="secondary" color={colors.muted}>
            Safety checks work without a server. Use the address of the team server on the same network.
          </AppText>
          <Field label="API address" value={url} onChange={setUrl} placeholder="http://192.168.x.x:8000" editable={!busy} />
          <Field label="User name" value={userId} onChange={setUserId} placeholder="demo-patient" editable={!busy} />
          <View style={styles.row}>
            <Button label="Sign in as patient" disabled={busy || !url.trim()} fullWidth={false} style={styles.grow}
              onPress={() => void signInDev(url, userId, 'patient')} />
            <Button label="Sign in as doctor" variant="outline" disabled={busy || !url.trim()} fullWidth={false} style={styles.grow}
              onPress={() => void signInDev(url, userId, 'doctor')} />
          </View>
          <AppText variant="secondary" color={colors.muted}>
            The server decides the role. If development sign-in is off, paste a server-issued access token:
          </AppText>
          <Field label="Access token" value={token} onChange={setToken} placeholder="Server-issued access token" secure editable={!busy} />
          <Button label="Connect with token" variant="outline" disabled={busy || !url.trim() || !token.trim()}
            onPress={() => void connectWithToken(url, token).then(() => setToken(''))} />
          {busy ? <AppText accessibilityRole="alert">Contacting the server…</AppText> : null}
        </Card>
      )}
      <Problem text={error} />
    </ServerScreen>
  );
}

function Field({ label, value, onChange, placeholder, secure = false, editable }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; secure?: boolean; editable: boolean;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="secondary" color={colors.navy} style={styles.label}>{label}</AppText>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} editable={editable}
        secureTextEntry={secure} autoCapitalize="none" autoCorrect={false} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  label: { fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 2, borderColor: colors.fieldBorder, borderRadius: radius.card, paddingHorizontal: spacing.md, backgroundColor: colors.white },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  grow: { flexGrow: 1, flexBasis: 140 },
});
