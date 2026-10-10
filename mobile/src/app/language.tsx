import { router } from 'expo-router';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { LANGUAGES } from '../i18n';
import type { Language } from '../i18n';
import { useSettings, useT } from '../store/settings';
import { colors } from '../theme';

// Each language is shown in its own script so people can find theirs.
const LABEL_KEYS = { en: 'language.en', ur: 'language.ur', roman: 'language.roman' } as const;

export default function LanguageScreen() {
  const t = useT();
  const chooseLanguage = useSettings((s) => s.chooseLanguage);
  const pick = (lang: Language) => {
    chooseLanguage(lang);
    router.replace('/');
  };
  return (
    <Screen title={t('appName')}>
      <AppText variant="display" color={colors.navy}>
        {t('language.title')}
      </AppText>
      <AppText variant="secondary" color={colors.muted}>
        {t('language.subtitle')}
      </AppText>
      {LANGUAGES.map((lang) => (
        <Button key={lang} label={t(LABEL_KEYS[lang])} onPress={() => pick(lang)} />
      ))}
    </Screen>
  );
}
