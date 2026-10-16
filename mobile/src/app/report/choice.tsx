import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { IconTile } from '../../components/IconTile';
import { Screen } from '../../components/Screen';
import { SafeGuard } from '../../flow/SafeGuard';
import { useT } from '../../store/settings';
import { useMemo } from 'react';
import { useTheme } from '../../ui/ThemeProvider';
import type { Palette } from '../../ui/theme';


/** After the result (design P13b): talk to a doctor, or get advice from the AI assistant. Both are stubs. */
export default function Choice() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  return (
    <SafeGuard>
      <Screen onBack={() => router.back()}>
        <AppText variant="h1" color={colors.text}>
          {t('choice.title')}
        </AppText>
        <AppText variant="body" color={colors.muted}>
          {t('choice.subtitle')}
        </AppText>
        <Card onPress={() => router.push('/report/assistant')} accessibilityLabel={t('choice.assistant')} style={styles.card}>
          <View style={styles.row}>
            <IconTile icon="sparkles-outline" tone="teal" />
            <AppText variant="bodyStrong" color={colors.text} style={styles.col}>
              {t('choice.assistant')}
            </AppText>
          </View>
          <AppText variant="secondary" color={colors.muted}>
            {t('choice.assistantSub')}
          </AppText>
          <View style={styles.tag}>
            <AppText variant="secondary" color={colors.accentText} style={styles.tagText}>
              {t('choice.infoOnly')}
            </AppText>
          </View>
        </Card>
        <Card onPress={() => router.push('/report/doctor')} accessibilityLabel={t('choice.doctor')} style={styles.card}>
          <View style={styles.row}>
            <IconTile icon="chatbubble-outline" tone="navy" />
            <AppText variant="bodyStrong" color={colors.text} style={styles.col}>
              {t('choice.doctor')}
            </AppText>
          </View>
          <AppText variant="secondary" color={colors.muted}>
            {t('choice.doctorSub')}
          </AppText>
        </Card>
        <Button variant="text" label={t('choice.book')} onPress={() => router.push('/book')} />
      </Screen>
    </SafeGuard>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  card: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  col: { flex: 1 },
  tag: { alignSelf: 'flex-start', backgroundColor: colors.accentTint, borderRadius: 8, paddingHorizontal: 10, height: 28, justifyContent: 'center' },
  tagText: { fontWeight: '700' },
});
