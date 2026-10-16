import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Screen } from '../../components/Screen';
import { LANGUAGES } from '../../i18n';
import { useSettings, useT } from '../../store/settings';
import { spacing } from '../../theme';
import { useThemePref, useTheme } from '../../ui/ThemeProvider';

const THEME_OPTIONS = [
  { pref: 'system', label: 'profile.themeSystem', icon: 'phone-portrait-outline' },
  { pref: 'light', label: 'profile.themeLight', icon: 'sunny-outline' },
  { pref: 'dark', label: 'profile.themeDark', icon: 'moon-outline' },
] as const;

const LABEL_KEYS = { en: 'language.en', ur: 'language.ur', roman: 'language.roman' } as const;

export default function Profile() {
  const { colors } = useTheme();
  const t = useT();
  const pref = useThemePref((s) => s.pref);
  const setPref = useThemePref((s) => s.setPref);
  const { language, chooseLanguage, needsRestart, signOut } = useSettings();
  return (
    <Screen title={t('profile.title')} navSpace>
      <AppText variant="h2" color={colors.text}>
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
      <AppText variant="h2" color={colors.text}>
        {t('profile.theme')}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {THEME_OPTIONS.map((o) => (
          <Chip key={o.pref} label={t(o.label)} icon={o.icon} selected={pref === o.pref} onPress={() => setPref(o.pref)} />
        ))}
      </View>
      <Button label="Server (demo)" variant="outline" onPress={() => router.push('/server' as never)} />
      <Button label={t('profile.about')} variant="outline" onPress={() => router.push('/about')} />
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
