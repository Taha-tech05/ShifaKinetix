import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../i18n';
import type { TKey } from '../i18n';

import { AppText } from './AppText';
import { useMemo } from 'react';
import { useTheme } from '../ui/ThemeProvider';
import type { Palette } from '../ui/theme';

export type Status = 'safe' | 'caution' | 'urgent' | 'unknown';

// Never colour alone: every status also has an icon and a word.
const config = (colors: Palette): Record<Status, { icon: keyof typeof Ionicons.glyphMap; label: TKey; fg: string; bg: string }> => ({
  safe: { icon: 'checkmark-circle-outline', label: 'status.safe', fg: colors.safe, bg: colors.safeTint },
  caution: { icon: 'alert-circle-outline', label: 'status.caution', fg: colors.caution, bg: colors.cautionTint },
  urgent: { icon: 'warning-outline', label: 'status.urgent', fg: colors.dangerDark, bg: colors.dangerTint },
  unknown: { icon: 'information-circle-outline', label: 'status.unknown', fg: colors.accentText, bg: colors.accentTint },
});

/** Small status pill (design .st): 32 high, radius 14, icon + word on a soft tint. `label` overrides the default word. */
export function StatusChip({ status, label }: { status: Status; label?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const c = config(colors)[status];
  const text = label ?? t(c.label);
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]} accessible accessibilityLabel={text}>
      <Ionicons name={c.icon} size={16} color={c.fg} />
      <AppText variant="secondary" color={c.fg} style={styles.label}>
        {text}
      </AppText>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  label: { fontWeight: '700' },
});
