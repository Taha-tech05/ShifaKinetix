import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { useT } from '../../store/settings';
import { colors } from '../../theme';
import { SafetyStopNotice } from '../../gate/SafetyStopNotice';

const HOSPITAL_SEARCH_URL = 'https://www.google.com/maps/search/?api=1&query=hospital';

/**
 * RED_FLAG (design P8). The flow stops here: no movements, no narrowing, no result. The patient is told to see a
 * doctor now and can call 1122. There is no advice text.
 */
export default function Urgent() {
  const t = useT();
  return (
    <Screen
      scroll={true}
      footer={
        <>
          <Button label={t('urgent.doctor')} onPress={() => router.push('/report/doctor')} style={{ backgroundColor: colors.danger }} />
          <Button label={t('sos.call')} variant="outline" icon="call-outline" onPress={() => Linking.openURL('tel:1122')} />
          <Button label={t('sos.hospital')} variant="text" onPress={() => Linking.openURL(HOSPITAL_SEARCH_URL)} />
        </>
      }
    >
      <SafetyStopNotice />
      <View style={styles.center}>
        <View style={styles.halo}>
          <View style={styles.disc}>
            <Ionicons name="warning-outline" size={56} color={colors.danger} />
          </View>
        </View>
        <AppText variant="h1" color={colors.navy} style={styles.title}>
          {t('urgent.title')}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  halo: { width: 160, height: 160, borderRadius: 80, backgroundColor: colors.dangerTint, alignItems: 'center', justifyContent: 'center' },
  disc: { width: 108, height: 108, borderRadius: 54, backgroundColor: '#F7D4CF', alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center' },
});
