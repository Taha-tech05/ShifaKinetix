import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LANGUAGES } from '../i18n';
import type { Language } from '../i18n';
import { useSettings, useT } from '../store/settings';
import { FloatingControl } from './FloatingControl';
import { useTheme } from './ThemeProvider';
import { MIN_TOUCH, font } from './theme';

const NAME = { en: 'language.en', ur: 'language.ur', roman: 'language.roman' } as const;
const SHORT: Record<Language, string> = { en: 'EN', ur: 'اردو', roman: 'Roman' };

/**
 * Globe button that opens the language list. The list is a popover in its own layer (a Modal), so it is never clipped by the sheet or the
 * header it was opened from, and it is solid so every option reads clearly.
 */
export function LanguageMenu() {
  const t = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const language = useSettings((s) => s.language) ?? 'en';
  const choose = useSettings((s) => s.chooseLanguage);
  return (
    <>
      <FloatingControl icon="globe-outline" label={t('scene.language')} onPress={() => setOpen(true)} selected={open} />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} style={[styles.backdrop, { backgroundColor: colors.scrim }]} onPress={() => setOpen(false)} />
        <View style={[styles.card, { top: insets.top + 72, backgroundColor: colors.menuFill, borderColor: colors.lineStrong }]} accessibilityViewIsModal>
          <Text style={[font.caption, styles.title, { color: colors.muted }]} accessibilityRole="header">
            {t('scene.language')}
          </Text>
          {LANGUAGES.map((lang) => {
            const on = language === lang;
            return (
              <Pressable
                key={lang}
                accessibilityRole="button"
                accessibilityLabel={t(NAME[lang])}
                accessibilityState={{ selected: on }}
                onPress={() => {
                  choose(lang);
                  setOpen(false);
                }}
                style={[styles.row, { backgroundColor: on ? colors.accentFill : 'transparent', borderColor: on ? colors.accentFill : colors.lineStrong }]}
              >
                <Text style={[font.body, styles.short, { color: on ? colors.onAccent : colors.accentText }]}>{SHORT[lang]}</Text>
                <Text style={[font.body, styles.name, { color: on ? colors.onAccent : colors.text }]}>{t(NAME[lang])}</Text>
                {on ? <Ionicons name="checkmark" size={22} color={colors.onAccent} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...(StyleSheet.absoluteFill as object) },
  card: { position: 'absolute', end: 16, start: 16, borderRadius: 26, borderWidth: 1.5, padding: 14, gap: 8 },
  title: { fontWeight: '800', paddingHorizontal: 4 },
  row: { minHeight: MIN_TOUCH + 8, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5 },
  short: { fontWeight: '800', minWidth: 56 },
  name: { flex: 1, fontWeight: '600' },
});
