import { Pressable, StyleSheet, View } from 'react-native';
import { LANGUAGES } from '../i18n';
import type { Language } from '../i18n';
import { useSettings } from '../store/settings';

import { AppText } from './AppText';
import { useMemo } from 'react';
import { useTheme } from '../ui/ThemeProvider';
import type { Palette } from '../ui/theme';

// Short labels shown in the header, as in the design: EN | اردو | Roman
const SHORT: Record<Language, string> = { en: 'EN', ur: 'اردو', roman: 'Roman' };

/** Segmented EN / Urdu / Roman switch for the top bar. */
export function LanguageToggle() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
            <AppText variant="secondary" color={on ? colors.onAccent : colors.text} style={on ? styles.bold : undefined}>
              {SHORT[lang]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 26,
    backgroundColor: colors.glassFill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  seg: { minWidth: 40, height: 48, paddingHorizontal: 6, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: colors.accentFill },
  bold: { fontWeight: '700' },
});
