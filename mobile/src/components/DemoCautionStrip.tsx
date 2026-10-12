import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useT } from '../store/settings';
import { colors } from '../theme';
import { AppText } from './AppText';

/**
 * One slim strip with both required messages: the demo notice and the movement caution line. Used on the question screen, where
 * the two separate banners would take too much height. The amber background and the warning icon stay, so the caution is as
 * visible as before.
 */
export function DemoCautionStrip() {
  const t = useT();
  return (
    <View style={styles.strip} accessibilityRole="alert">
      <Ionicons name="warning-outline" size={18} color="#6B4A0F" />
      <View style={styles.texts}>
        <AppText variant="secondary" color={colors.navy} style={styles.demo} numberOfLines={1}>
          {t('demoBanner')}
        </AppText>
        <AppText variant="secondary" color="#6B4A0F" style={styles.caution}>
          {t('moveSafely')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: colors.cautionTint, borderBottomWidth: 1, borderBottomColor: '#EBD6A6' },
  texts: { flex: 1 },
  demo: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  caution: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
});
