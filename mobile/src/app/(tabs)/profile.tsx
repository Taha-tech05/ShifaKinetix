import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Screen } from '../../components/Screen';
import { LANGUAGES } from '../../i18n';
import { useSettings, useT } from '../../store/settings';
import { Chip } from '../../ui/Chip';
import { GlassCard } from '../../ui/GlassCard';
import { ListRow } from '../../ui/ListRow';
import { SectionHeader } from '../../ui/SectionHeader';
import { useThemePref, useTheme } from '../../ui/ThemeProvider';

const THEME_OPTIONS = [
  { pref: 'system', label: 'profile.themeSystem', icon: 'phone-portrait-outline' },
  { pref: 'light', label: 'profile.themeLight', icon: 'sunny-outline' },
  { pref: 'dark', label: 'profile.themeDark', icon: 'moon-outline' },
] as const;

const LABEL_KEYS = { en: 'language.en', ur: 'language.ur', roman: 'language.roman' } as const;

/** Profile: the person card on top, then the settings, then the rows (list structure of the "Medical Records" reference). */
export default function Profile() {
  const { colors } = useTheme();
  const t = useT();
  const pref = useThemePref((s) => s.pref);
  const setPref = useThemePref((s) => s.setPref);
  const { language, chooseLanguage, needsRestart, signOut } = useSettings();
  return (
    <Screen title={t('profile.title')} navSpace>
      <GlassCard row>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="h3" color={colors.onAccent}>
            PA
          </AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="h3">{t('home.demoName')}</AppText>
          <AppText variant="secondary" color={colors.muted}>
            {t('common.patient')}
          </AppText>
        </View>
      </GlassCard>

      <SectionHeader title={t('profile.language')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {LANGUAGES.map((lang) => (
          <Chip key={lang} label={t(LABEL_KEYS[lang])} selected={language === lang} onPress={() => chooseLanguage(lang)} />
        ))}
      </View>
      {needsRestart ? (
        <AppText variant="secondary" color={colors.muted}>
          {t('profile.restartNote')}
        </AppText>
      ) : null}

      <SectionHeader title={t('profile.theme')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {THEME_OPTIONS.map((o) => (
          <Chip key={o.pref} label={t(o.label)} icon={o.icon} selected={pref === o.pref} onPress={() => setPref(o.pref)} />
        ))}
      </View>

      <View style={{ gap: 12 }}>
        <ListRow icon="server-outline" title="Server (demo)" onPress={() => router.push('/server' as never)} />
        <ListRow icon="shield-checkmark-outline" title={t('profile.about')} onPress={() => router.push('/about')} />
        <ListRow
          icon="log-out-outline"
          title={t('profile.signOut')}
          onPress={() => {
            signOut();
            router.replace('/');
          }}
        />
      </View>
    </Screen>
  );
}
