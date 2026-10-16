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

/** Still unclear after the re-ask (design P32). The flow stops: to be safe, the patient is sent to a doctor. Same calm takeover as the urgent state. */
export default function Unclear() {
  const t = useT();
  const { colors } = useTheme();
  useSceneStep({ stepKey: 'unclear', mode: 'caution', progress: { label: t('unclear.doctor'), value: 1 } });
  return (
    <SceneSheetContent contentKey="unclear">
      <SafetyStopNotice />
      <AutoUploadNotice />
      <BotBubble tone="caution" label={t('unclear.title')}>
        <View style={styles.row}>
          <Ionicons name="help-circle-outline" size={28} color={colors.cautionBase} />
          <AppText variant="bodyStrong" color={colors.text} style={styles.title} accessibilityRole="header">
            {t('unclear.title')}
          </AppText>
        </View>
      </BotBubble>
      <Button label={t('unclear.doctor')} onPress={() => router.push('/report/doctor')} />
      <Button label={`${t('scene.callHelp')} · ${t('scene.callHelpSub')}`} variant="outline" icon="call-outline" onPress={() => Linking.openURL('tel:1122')} />
    </SceneSheetContent>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1 },
});
