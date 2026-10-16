import { router } from 'expo-router';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { useT } from '../store/settings';
import { useTheme } from '../ui/ThemeProvider';


/** Privacy note and the 3D model credit (CC BY-SA requires the credit to be shown). */
export default function About() {
  const { colors } = useTheme();
  const t = useT();
  return (
    <Screen title={t('about.title')} onBack={() => router.back()}>
      <AppText variant="h2" color={colors.text}>
        {t('about.privacyTitle')}
      </AppText>
      <AppText variant="body">{t('about.privacy')}</AppText>
      <AppText variant="h2" color={colors.text}>
        {t('about.creditTitle')}
      </AppText>
      <Card tone="gray">
        <AppText variant="body" selectable>
          {t('about.credit')}
        </AppText>
      </Card>
      <AppText variant="secondary" color={colors.muted}>
        {t('about.modelNote')}
      </AppText>
    </Screen>
  );
}
