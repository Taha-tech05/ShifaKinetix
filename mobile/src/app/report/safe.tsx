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
import { levelReasons } from '../../gate/safetyFlow';
import { AssessmentSync } from '../../gate/AssessmentSync';
import { BotBubble } from '../../ui/chat';
import { SceneSheetContent, useSceneStep } from '../../ui/SceneSheetContent';
import { useTheme } from '../../ui/ThemeProvider';

/**
 * SAFE verdict (design P9). Only now can the patient go on to movements (region mode) or follow-up questions (exact mode).
 * The SOON care level (one warning sign, or a few small ones) says to see a doctor in the next few days, with the reasons; the
 * questions continue but the physical movement checks are skipped.
 */
export default function Safe() {
  const { colors } = useTheme();
  const t = useT();
  const mode = useSession((s) => s.mode) ?? 'region';
  const output = useSession((s) => s.gateOutput);
  const soon = output?.verdict === 'SAFE' && output.level === 'SOON';
  const region = mode === 'region' && !soon;
  const reasons = soon ? levelReasons(output, t('triage.uncertain')) : [];
  async function onSafe() {
    try {
      const output = await (await openSafetySession()).checkpoint();
      router.replace((output.verdict === 'SAFE' ? routeAfterSafe(mode, useSession.getState().movementsBlocked)
        : routeAfterGate(output.verdict, useSession.getState().reaskDone)) as never);
    } catch { router.replace('/report/danger'); }
  }
  useSceneStep({ stepKey: 'safe', mode: 'questions', progress: { label: t('scene.phaseSafety', { n: 8, total: 8 }), value: 1 } });
  return (
    <SafeGuard>
      <SceneSheetContent contentKey="safe" onBack={() => router.back()}>
        <AssessmentSync />
        {soon ? <BotBubble tone="caution" label={t('triage.soonTitle')}>
          <View style={styles.row}>
            <Ionicons name="medkit-outline" size={28} color={colors.cautionBase} />
            <StatusChip status="caution" label={t('triage.soonChip')} />
          </View>
          <AppText variant="bodyStrong" color={colors.text}>{t('triage.soonTitle')}</AppText>
          <AppText color={colors.text}>{t('triage.soonBody')}</AppText>
          {reasons.length > 0 && <AppText variant="secondary" color={colors.muted}>{t('triage.because', { reasons: reasons.join('; ') })}</AppText>}
          <AppText variant="secondary" color={colors.muted}>{t('triage.soonNext')}</AppText>
        </BotBubble> : <BotBubble label={t('safe.title')}>
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
        </BotBubble>}
        <Button label={t('common.continue')} onPress={() => { void onSafe(); }} />
      </SceneSheetContent>
    </SafeGuard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
