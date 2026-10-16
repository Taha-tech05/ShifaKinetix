import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { useT } from '../../store/settings';
import { SafetyStopNotice } from '../../gate/SafetyStopNotice';
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
  useSceneStep({ stepKey: 'urgent', mode: 'redflag', progress: { label: t('urgent.title'), value: 1 } });
  return (
    <SceneSheetContent contentKey="urgent">
      <SafetyStopNotice />
      <AutoUploadNotice />
      <BotBubble tone="alert" label={t('urgent.title')}>
        <View style={styles.row}>
          <Ionicons name="warning-outline" size={28} color={colors.danger} />
          <AppText variant="h2" color={colors.danger} style={styles.title} accessibilityRole="header">
            {t('urgent.title')}
          </AppText>
        </View>
      </BotBubble>
      <Button label={t('scene.connectDoctor')} onPress={() => router.push('/report/doctor')} style={{ backgroundColor: colors.danger }} />
      <Button label={`${t('scene.callHelp')} · ${t('scene.callHelpSub')}`} variant="outline" icon="call-outline" onPress={() => Linking.openURL('tel:1122')} />
      <Button label={t('sos.hospital')} variant="text" onPress={() => Linking.openURL(HOSPITAL_SEARCH_URL)} />
    </SceneSheetContent>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1 },
});
