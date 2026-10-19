import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { useT } from '../../store/settings';
import { SafetyStopNotice } from '../../gate/SafetyStopNotice';
import { levelReasons } from '../../gate/safetyFlow';
import { useSession } from '../../store/session';
import { AutoUploadNotice } from '../../server/autoUpload';
import { BotBubble } from '../../ui/chat';
import { SceneSheetContent, useSceneStep } from '../../ui/SceneSheetContent';
import { useTheme } from '../../ui/ThemeProvider';

const HOSPITAL_SEARCH_URL = 'https://www.google.com/maps/search/?api=1&query=hospital';

/**
 * RED_FLAG (design P8). The flow stops here: no movements, no narrowing, no result, no questions, no exercises, no AI suggestions.
 * The sheet takes over in a calm red state (no animation) and the body behind it dims. The patient is told to see a doctor now and
 * can call 1122. There is no advice text. The chat history stays above and goes with the patient into the doctor thread.
 */
export default function Urgent() {
  const t = useT();
  const { colors } = useTheme();
  const output = useSession((s) => s.gateOutput);
  // EMERGENCY (chest or breathing): calling for help comes first. URGENT: see a doctor today.
  const emergency = output?.level === 'EMERGENCY';
  const title = emergency ? t('triage.emergencyTitle') : t('urgent.title');
  const reasons = output?.verdict === 'RED_FLAG' ? levelReasons(output, t('triage.uncertain')) : [];
  const call = <Button label={`${t('scene.callHelp')} · ${t('scene.callHelpSub')}`} variant={emergency ? undefined : 'outline'} icon="call-outline"
    onPress={() => Linking.openURL('tel:1122')} style={emergency ? { backgroundColor: colors.danger } : undefined} />;
  useSceneStep({ stepKey: 'urgent', mode: 'redflag', progress: { label: title, value: 1 } });
  return (
    <SceneSheetContent contentKey="urgent">
      <SafetyStopNotice />
      <AutoUploadNotice />
      <BotBubble tone="alert" label={title}>
        <View style={styles.row}>
          <Ionicons name="warning-outline" size={28} color={colors.danger} />
          <AppText variant="h2" color={colors.danger} style={styles.title} accessibilityRole="header">
            {title}
          </AppText>
        </View>
        {reasons.length > 0 && <AppText variant="secondary" color={colors.text}>{t('triage.because', { reasons: reasons.join('; ') })}</AppText>}
      </BotBubble>
      {emergency && call}
      <Button label={t('scene.connectDoctor')} onPress={() => router.push('/report/doctor')}
        variant={emergency ? 'outline' : undefined} style={emergency ? undefined : { backgroundColor: colors.danger }} />
      {!emergency && call}
      <Button label={t('sos.hospital')} variant="text" onPress={() => Linking.openURL(HOSPITAL_SEARCH_URL)} />
    </SceneSheetContent>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1 },
});
