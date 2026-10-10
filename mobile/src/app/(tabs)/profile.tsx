import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Screen } from '../../components/Screen';
import { LANGUAGES } from '../../i18n';
import { useSettings, useT } from '../../store/settings';
import { colors, spacing } from '../../theme';

const LABEL_KEYS = { en: 'language.en', ur: 'language.ur', roman: 'language.roman' } as const;

export default function Profile() {
  const t = useT();
  const { language, chooseLanguage, needsRestart, signOut } = useSettings();
  return (
    <Screen title={t('profile.title')}>
      <AppText variant="h2" color={colors.navy}>
        {t('profile.language')}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {LANGUAGES.map((lang) => (
          <Chip
            key={lang}
            label={t(LABEL_KEYS[lang])}
            selected={language === lang}
            onPress={() => chooseLanguage(lang)}
          />
        ))}
      </View>
      {needsRestart ? (
        <AppText variant="secondary" color={colors.muted}>
          {t('profile.restartNote')}
        </AppText>
      ) : null}
      <Button
        label={t('profile.signOut')}
        variant="outline"
        onPress={() => {
          signOut();
          router.replace('/');
        }}
      />
    </Screen>
  );
}
