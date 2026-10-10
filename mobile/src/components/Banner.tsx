import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../store/settings';
import { colors, spacing } from '../theme';
import { AppText } from './AppText';

export type BannerKind = 'demo' | 'offline';

export function Banner({ kind }: { kind: BannerKind }) {
  const t = useT();
  const demo = kind === 'demo';
  const fg = demo ? colors.caution : colors.navy;
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: demo ? colors.cautionTint : colors.neutralTint }]}
    >
      <Ionicons name={demo ? 'information-circle' : 'cloud-offline'} size={18} color={fg} />
      <AppText variant="secondary" color={fg} style={styles.text}>
        {demo ? t('demoBanner') : t('offlineBanner')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1, fontWeight: '600' },
});
