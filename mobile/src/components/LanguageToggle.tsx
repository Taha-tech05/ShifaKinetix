import { Pressable, StyleSheet, View } from 'react-native';
import { LANGUAGES } from '../i18n';
import type { Language } from '../i18n';
import { useSettings } from '../store/settings';
import { colors } from '../theme';
import { AppText } from './AppText';

// Short labels shown in the header, as in the design: EN | اردو | Roman
const SHORT: Record<Language, string> = { en: 'EN', ur: 'اردو', roman: 'Roman' };

/** Segmented EN / Urdu / Roman switch for the top bar. */
export function LanguageToggle() {
  const language = useSettings((s) => s.language) ?? 'en';
  const chooseLanguage = useSettings((s) => s.chooseLanguage);
  return (
    <View style={styles.wrap}>
      {LANGUAGES.map((lang) => {
        const on = language === lang;
        return (
          <Pressable
            key={lang}
            accessibilityRole="button"
            accessibilityLabel={SHORT[lang]}
            accessibilityState={{ selected: on }}
            onPress={() => chooseLanguage(lang)}
            style={[styles.seg, on && styles.on]}
          >
            <AppText variant="secondary" color={on ? colors.navy : colors.white} style={on ? styles.bold : undefined}>
              {SHORT[lang]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  seg: { minWidth: 40, height: 48, paddingHorizontal: 6, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: colors.white },
  bold: { fontWeight: '700' },
});
