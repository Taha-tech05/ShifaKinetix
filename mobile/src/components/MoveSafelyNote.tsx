import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../store/settings';
import { radius, spacing } from '../theme';
import { AppText } from './AppText';
import { useMemo } from 'react';
import { useTheme } from '../ui/ThemeProvider';
import type { Palette } from '../ui/theme';

/** Required on every movement or exercise screen. */
export function MoveSafelyNote() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  return (
    <View style={styles.box}>
      <Ionicons name="information-circle" size={22} color={colors.text} />
      <AppText variant="body" color={colors.text} style={styles.text}>
        {t('moveSafely')}
      </AppText>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.accentTint,
  },
  text: { flex: 1 },
});
