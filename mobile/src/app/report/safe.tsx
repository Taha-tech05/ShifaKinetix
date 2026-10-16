import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { StatusChip } from '../../components/StatusChip';
import { routeAfterGate, routeAfterSafe } from '../../flow/intake';
import { SafeGuard } from '../../flow/SafeGuard';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';

import { openSafetySession } from '../../gate/safetySession';
import { AssessmentSync } from '../../gate/AssessmentSync';
import { BotBubble } from '../../ui/chat';
import { SceneSheetContent, useSceneStep } from '../../ui/SceneSheetContent';
import { useTheme } from '../../ui/ThemeProvider';

/** SAFE verdict (design P9). Only now can the patient go on to movements (region mode) or follow-up questions (exact mode). */
export default function Safe() {
  const { colors } = useTheme();
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
  useSceneStep({ stepKey: 'safe', mode: 'questions', progress: { label: t('scene.phaseSafety', { n: 8, total: 8 }), value: 1 } });
  return (
    <SafeGuard>
      <SceneSheetContent contentKey="safe" onBack={() => router.back()}>
        <AssessmentSync />
        <BotBubble label={t('safe.title')}>
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={28} color={colors.safe} />
            <StatusChip status="safe" label={t('safe.chip')} />
          </View>
          <AppText variant="bodyStrong" color={colors.text}>
            {t('safe.title')}
          </AppText>
          <AppText variant="secondary" color={colors.muted}>
            {region ? t('safe.nextMovements') : t('safe.nextQuestions')}
          </AppText>
        </BotBubble>
        <Button label={t('common.continue')} onPress={() => { void onSafe(); }} />
      </SceneSheetContent>
    </SafeGuard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
