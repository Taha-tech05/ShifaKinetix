import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { BodyFigure } from '../../components/BodyFigure';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { StepProgress } from '../../components/StepProgress';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { colors, shadows } from '../../theme';

/** P4 (design): step 1 of 5, "Tap where it hurts", body preview, Start, emergency line. */
export default function Intro() {
  const t = useT();
  const reset = useSession((s) => s.reset);
  return (
    <Screen
      scroll={false}
      onBack={() => router.back()}
      footer={
        <>
          <Button
            label={t('intro.start')}
            onPress={() => {
              reset();
              router.push('/report/body');
            }}
          />
          <AppText variant="secondary" color={colors.muted} style={styles.emergency}>
            {t('notEmergency')}
          </AppText>
        </>
      }
    >
      <StepProgress step={1} total={5} />
      <View style={styles.head}>
        <AppText variant="h1" color={colors.navy}>
          {t('intro.title')}
        </AppText>
        <AppText variant="secondary" color={colors.muted}>
          {t('intro.time')}
        </AppText>
      </View>
      <BodyFigure height="fill">
        <View style={styles.pill}>
          <Ionicons name="time-outline" size={18} color={colors.navy} />
          <AppText variant="secondary" color={colors.navy} style={styles.bold}>
            {t('intro.timeChip')}
          </AppText>
        </View>
      </BodyFigure>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 4 },
  emergency: { textAlign: 'center', paddingVertical: 4 },
  pill: {
    position: 'absolute',
    top: 12,
    start: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    ...shadows.card,
  },
  bold: { fontWeight: '600' },
});
