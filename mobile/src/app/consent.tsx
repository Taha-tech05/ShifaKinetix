import { router } from 'expo-router';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { useSettings, useT } from '../store/settings';
import { colors } from '../theme';

export default function Consent() {
  const t = useT();
  const giveConsent = useSettings((s) => s.giveConsent);
  return (
    <Screen title={t('consent.title')} onBack={() => router.replace('/login')}>
      <AppText variant="display" color={colors.navy}>
        {t('consent.title')}
      </AppText>
      <Card tone="mint">
        <AppText variant="body" color={colors.navy}>
          {t('consent.body')}
        </AppText>
      </Card>
      <Button
        label={t('consent.agree')}
        onPress={() => {
          giveConsent();
          router.replace('/home');
        }}
      />
    </Screen>
  );
}
