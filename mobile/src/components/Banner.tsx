import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../store/settings';
import { colors, spacing } from '../theme';
import { AppText } from './AppText';

export type BannerKind = 'demo' | 'offline';

/** Demo: slim grey strip with a small amber dot (design .demo). Offline: amber banner (design .ban). */
export function Banner({ kind }: { kind: BannerKind }) {
  const t = useT();
  if (kind === 'demo') {
    return (
      <View accessibilityRole="alert" style={styles.demo}>
        <View style={styles.dot} />
        <AppText variant="secondary" color={colors.navy} style={styles.demoText}>
          {t('demoBanner')}
        </AppText>
      </View>
    );
  }
  return (
    <View accessibilityRole="alert" style={styles.offline}>
      <Ionicons name="cloud-offline" size={18} color={colors.caution} />
      <AppText variant="secondary" color={colors.caution} style={styles.offlineText}>
        {t('offlineBanner')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  demo: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.neutralTint,
    paddingHorizontal: spacing.lg,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.cautionBase },
  demoText: { fontWeight: '600', lineHeight: 20 },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.cautionTint,
    borderRadius: 12,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  offlineText: { flex: 1, fontWeight: '600' },
});
