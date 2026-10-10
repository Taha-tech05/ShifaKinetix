import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { useT } from '../../store/settings';
import { colors } from '../../theme';

/** Still unclear after the re-ask (design P32). The flow stops: to be safe, the patient is sent to a doctor. */
export default function Unclear() {
  const t = useT();
  return (
    <Screen
      scroll={false}
      footer={
        <>
          <Button label={t('unclear.doctor')} onPress={() => router.push('/report/doctor')} />
          <Button label={t('sos.call')} variant="outline" icon="call-outline" onPress={() => Linking.openURL('tel:1122')} />
        </>
      }
    >
      <View style={styles.center}>
        <View style={styles.halo}>
          <View style={styles.disc}>
            <Ionicons name="help-circle-outline" size={56} color={colors.cautionBase} />
          </View>
        </View>
        <AppText variant="h1" color={colors.navy} style={styles.title}>
          {t('unclear.title')}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  halo: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#FBF1DC', alignItems: 'center', justifyContent: 'center' },
  disc: { width: 108, height: 108, borderRadius: 54, backgroundColor: '#F6E3B8', alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center' },
});
