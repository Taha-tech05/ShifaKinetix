import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../i18n';
import type { TKey } from '../i18n';
import { colors, radius, spacing } from '../theme';
import { AppText } from './AppText';

export type Status = 'safe' | 'caution' | 'urgent' | 'unknown';

// Never colour alone: every status also has an icon and a word.
const CONFIG: Record<
  Status,
  { icon: keyof typeof Ionicons.glyphMap; label: TKey; fg: string; bg: string }
> = {
  safe: { icon: 'checkmark-circle', label: 'status.safe', fg: colors.safe, bg: colors.safeTint },
  caution: { icon: 'alert-circle', label: 'status.caution', fg: colors.caution, bg: colors.cautionTint },
  urgent: { icon: 'warning', label: 'status.urgent', fg: colors.dangerDark, bg: colors.dangerTint },
  unknown: { icon: 'help-circle', label: 'status.unknown', fg: colors.navy, bg: colors.neutralTint },
};

export function StatusChip({ status }: { status: Status }) {
  const c = CONFIG[status];
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]} accessible accessibilityLabel={t(c.label)}>
      <Ionicons name={c.icon} size={18} color={c.fg} />
      <AppText variant="secondary" color={c.fg} style={styles.label}>
        {t(c.label)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  label: { fontWeight: '700' },
});
