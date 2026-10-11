import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { IconTile } from '../../components/IconTile';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { routeAfterGate, routeAfterSafe } from '../../flow/intake';
import { SafeGuard } from '../../flow/SafeGuard';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { colors } from '../../theme';
import { openSafetySession } from '../../gate/safetySession';

/** SAFE verdict (design P9). Only now can the patient go on to movements (region mode) or follow-up questions (exact mode). */
export default function Safe() {
  const t = useT();
  const mode = useSession((s) => s.mode) ?? 'region';
  const region = mode === 'region';
  async function onSafe() {
    try {
      const output = await (await openSafetySession()).checkpoint();
      router.replace((output.verdict === 'SAFE' ? routeAfterSafe(mode)
        : routeAfterGate(output.verdict, useSession.getState().reaskDone)) as never);
    } catch { router.replace('/report/danger'); }
  }
  return (
    <SafeGuard>
      <Screen
        scroll={false}
        footer={
          <>
            <Button label={t('common.continue')} onPress={() => { void onSafe(); }} />
            <Button variant="text" label={t('safe.doctorInstead')} onPress={() => router.push('/report/doctor')} />
          </>
        }
      >
        <View style={styles.center}>
          <View style={styles.halo}>
            <Ionicons name="checkmark-circle" size={96} color={colors.teal} />
          </View>
          <StatusChip status="safe" label={t('safe.chip')} />
          <AppText variant="h1" color={colors.navy} style={styles.title}>
            {t('safe.title')}
          </AppText>
          <AppText variant="body" color={colors.muted} style={styles.title}>
            {region ? t('safe.nextMovements') : t('safe.nextQuestions')}
          </AppText>
        </View>
        <Card row>
          <IconTile icon={region ? 'body-outline' : 'chatbubble-ellipses-outline'} tone="teal" />
          <View style={styles.col}>
            <AppText variant="bodyStrong" color={colors.navy}>
              {region ? t('safe.cardMovements') : t('safe.cardQuestions')}
            </AppText>
            <AppText variant="secondary" color={colors.muted}>
              {region ? t('safe.cardMovementsSub') : t('safe.cardQuestionsSub')}
            </AppText>
          </View>
        </Card>
      </Screen>
    </SafeGuard>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  halo: { width: 150, height: 150, borderRadius: 75, backgroundColor: colors.tealTint, alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center' },
  col: { flex: 1 },
});
