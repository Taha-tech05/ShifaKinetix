import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconTile } from '../components/IconTile';
import { Screen } from '../components/Screen';
import type { TKey } from '../i18n';
import { useSettings, useT } from '../store/settings';
import { colors } from '../theme';

const POINTS: { icon: 'document-text-outline' | 'lock-closed-outline' | 'refresh-outline'; tone: 'teal' | 'navy' | 'safe'; text: TKey }[] = [
  { icon: 'document-text-outline', tone: 'teal', text: 'consent.p1' },
  { icon: 'lock-closed-outline', tone: 'navy', text: 'consent.p2' },
  { icon: 'refresh-outline', tone: 'safe', text: 'consent.p3' },
];

/** Consent (design P2b): three short cards, I agree, Not now. */
export default function Consent() {
  const t = useT();
  const giveConsent = useSettings((s) => s.giveConsent);
  return (
    <Screen
      onBack={() => router.back()}
      footer={
        <>
          <Button
            label={t('consent.agree')}
            onPress={() => {
              giveConsent();
              router.replace('/home');
            }}
          />
          <Button variant="text" label={t('consent.notNow')} onPress={() => router.replace('/login')} />
        </>
      }
    >
      <View style={styles.head}>
        <IconTile icon="shield-checkmark-outline" tone="safe" size={56} />
        <View style={styles.col}>
          <AppText variant="h1" color={colors.navy}>
            {t('consent.title')}
          </AppText>
          <AppText variant="secondary" color={colors.muted}>
            {t('consent.subtitle')}
          </AppText>
        </View>
      </View>
      {POINTS.map((p) => (
        <Card key={p.text} row>
          <IconTile icon={p.icon} tone={p.tone} />
          <AppText variant="body" style={styles.col}>
            {t(p.text)}
          </AppText>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  col: { flex: 1 },
});
