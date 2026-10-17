import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconTile } from '../components/IconTile';
import { Screen } from '../components/Screen';
import { useSettings, useT } from '../store/settings';
import { useMemo } from 'react';
import { useTheme } from '../ui/ThemeProvider';
import type { Palette } from '../ui/theme';


/** Fake login for the demo: nothing is checked or sent anywhere (design P2). */
export default function Login() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const signIn = useSettings((s) => s.signIn);
  const [phone, setPhone] = useState('demo.patient@example.com');
  const [password, setPassword] = useState('demo-password');
  return (
    <Screen
      onBack={() => router.replace('/language')}
      footer={
        <>
          <Button
            label={t('login.continue')}
            onPress={() => {
              signIn();
              router.replace('/');
            }}
          />
          <Button variant="text" label={t('login.forgot')} onPress={() => undefined} />
        </>
      }
    >
      <IconTile icon="lock-closed-outline" tone="teal" />
      <View style={styles.head}>
        <AppText variant="h1" color={colors.text}>
          {t('login.title')}
        </AppText>
        <AppText variant="body" color={colors.muted}>
          {t('login.subtitle')}
        </AppText>
      </View>
      <Card style={styles.form}>
        <View style={styles.field}>
          <AppText variant="bodyStrong" color={colors.text}>
            {t('login.phone')}
          </AppText>
          <View style={styles.input}>
            <Ionicons name="mail-outline" size={22} color={colors.muted} />
            <TextInput
              accessibilityLabel={t('login.phone')}
              value={phone}
              onChangeText={setPhone}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.text}
            />
          </View>
        </View>
        <View style={styles.field}>
          <AppText variant="bodyStrong" color={colors.text}>
            {t('login.password')}
          </AppText>
          <View style={styles.input}>
            <Ionicons name="key-outline" size={22} color={colors.muted} />
            <TextInput
              accessibilityLabel={t('login.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.text}
            />
          </View>
        </View>
      </Card>
      <View style={styles.agree}>
        <Ionicons name="shield-checkmark-outline" size={24} color={colors.accent} />
        <AppText variant="body" color={colors.text} style={styles.agreeText}>
          {t('login.agreePrefix')}
          <AppText
            variant="bodyStrong"
            color={colors.text}
            style={styles.link}
            onPress={() => router.push('/consent')}
            accessibilityRole="link"
          >
            {t('login.consentPage')}
          </AppText>
          {t('login.agreeSuffix')}
        </AppText>
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  head: { gap: 4 },
  form: { gap: 16 },
  field: { gap: 6 },
  input: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  text: { flex: 1, minHeight: 48, fontSize: 16, color: colors.text, textAlign: 'auto' },
  agree: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.accentTint,
    borderRadius: 14,
    padding: 12,
  },
  agreeText: { flex: 1 },
  link: { textDecorationLine: 'underline' },
});
