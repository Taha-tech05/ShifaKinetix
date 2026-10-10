import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { colors, spacing } from '../../theme';

export default function Intro() {
  const t = useT();
  const reset = useSession((s) => s.reset);
  return (
    <Screen title={t('intro.title')} onBack={() => router.back()}>
      <AppText variant="display" color={colors.navy}>
        {t('intro.title')}
      </AppText>
      <AppText variant="body">{t('intro.body')}</AppText>
      <Card
        tone="gray"
        accessibilityLabel={t('notEmergency')}
        onPress={() => Linking.openURL('tel:1122')}
      >
        <View style={styles.emergency}>
          <Ionicons name="call" size={22} color={colors.dangerDark} />
          <AppText variant="bodyStrong" color={colors.dangerDark} style={styles.emergencyText}>
            {t('notEmergency')}
          </AppText>
        </View>
      </Card>
      <Button
        label={t('intro.start')}
        onPress={() => {
          reset();
          router.push('/report/body');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  emergency: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emergencyText: { flex: 1 },
});
