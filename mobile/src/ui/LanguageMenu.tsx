import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LANGUAGES } from '../i18n';
import type { Language } from '../i18n';
import { useSettings, useT } from '../store/settings';
import { Chip } from './Chip';
import { useTheme } from './ThemeProvider';
import { FloatingControl } from './FloatingControl';

const SHORT: Record<Language, string> = { en: 'EN', ur: 'اردو', roman: 'Roman' };

/** Globe button that opens a small glass menu: EN / اردو / Roman. */
export function LanguageMenu() {
  const t = useT();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const language = useSettings((s) => s.language) ?? 'en';
  const choose = useSettings((s) => s.chooseLanguage);
  return (
    <View style={styles.wrap}>
      <FloatingControl icon="globe-outline" label={t('scene.language')} onPress={() => setOpen((o) => !o)} selected={open} />
      {open ? (
        <View style={[styles.menu, { backgroundColor: colors.menuFill, borderColor: colors.glassBorder }]}>
          {LANGUAGES.map((lang) => (
            <Chip
              key={lang}
              label={SHORT[lang]}
              selected={language === lang}
              onPress={() => {
                choose(lang);
                setOpen(false);
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end', zIndex: 5 },
  menu: { position: 'absolute', top: 56, end: 0, gap: 6, alignItems: 'stretch', padding: 8, borderRadius: 22, borderWidth: 1, zIndex: 30, elevation: 30 },
});
