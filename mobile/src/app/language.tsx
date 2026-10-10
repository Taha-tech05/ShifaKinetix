import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import type { TKey } from '../i18n';
import type { Language } from '../i18n';
import { useSettings, useT } from '../store/settings';
import { colors } from '../theme';

const OPTIONS: { lang: Language; badge: string; name: TKey; sub: TKey }[] = [
  { lang: 'en', badge: 'En', name: 'language.en', sub: 'language.enSub' },
  { lang: 'ur', badge: 'ا', name: 'language.ur', sub: 'language.urSub' },
  { lang: 'roman', badge: 'Ro', name: 'language.roman', sub: 'language.romanSub' },
];

/** Language list with radio cards (design P25a). Used on first launch and from Profile. */
export default function LanguageScreen() {
  const t = useT();
  const current = useSettings((s) => s.language);
  const chooseLanguage = useSettings((s) => s.chooseLanguage);
  const [picked, setPicked] = useState<Language>(current ?? 'en');
  return (
    <Screen
      onBack={current ? () => router.back() : undefined}
      footer={
        <Button
          label={t('language.save')}
          onPress={() => {
            chooseLanguage(picked);
            router.replace('/');
          }}
        />
      }
    >
      <AppText variant="h1" color={colors.navy}>
        {t('language.title')}
      </AppText>
      <AppText variant="body" color={colors.muted}>
        {t('language.subtitle')}
      </AppText>
      {OPTIONS.map((o) => {
        const on = picked === o.lang;
        return (
          <Card
            key={o.lang}
            row
            onPress={() => setPicked(o.lang)}
            accessibilityLabel={t(o.name)}
            style={[styles.opt, on && styles.on]}
          >
            <View style={[styles.badge, { backgroundColor: o.lang === 'en' ? colors.tealTint : colors.neutralTint }]}>
              <AppText variant="h2" color={o.lang === 'en' ? colors.teal : colors.navy}>
                {o.badge}
              </AppText>
            </View>
            <View style={styles.col}>
              <AppText variant="bodyStrong" color={colors.navy}>
                {t(o.name)}
              </AppText>
              <AppText variant="secondary" color={colors.muted}>
                {t(o.sub)}
              </AppText>
            </View>
            <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  opt: { minHeight: 64, borderWidth: 2, borderColor: 'transparent' },
  on: { borderColor: colors.teal, backgroundColor: '#F3FAFA' },
  badge: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  col: { flex: 1 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#A9B6C2', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.teal, backgroundColor: colors.teal },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.white },
});
