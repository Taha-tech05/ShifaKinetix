import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useSettings, useT } from '../store/settings';
import { colors, MIN_TAP, radius, spacing } from '../theme';

/** Fake login for the demo: nothing is checked or sent anywhere. */
export default function Login() {
  const t = useT();
  const signIn = useSettings((s) => s.signIn);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  return (
    <Screen title={t('login.title')} onBack={() => router.replace('/language')}>
      <AppText variant="display" color={colors.navy}>
        {t('login.title')}
      </AppText>
      <AppText variant="body" color={colors.muted}>
        {t('login.subtitle')}
      </AppText>
      <TextInput
        accessibilityLabel={t('login.phone')}
        placeholder={t('login.phone')}
        placeholderTextColor={colors.muted}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        style={styles.input}
      />
      <TextInput
        accessibilityLabel={t('login.password')}
        placeholder={t('login.password')}
        placeholderTextColor={colors.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />
      <Button
        label={t('login.signIn')}
        onPress={() => {
          signIn();
          router.replace('/');
        }}
      />
      <AppText variant="secondary" color={colors.muted}>
        {t('login.fakeNote')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: MIN_TAP + 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 16,
    textAlign: 'auto',
  },
});
