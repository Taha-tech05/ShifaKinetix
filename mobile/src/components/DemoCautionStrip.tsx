import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useT } from '../store/settings';

import { AppText } from './AppText';
import { useMemo } from 'react';
import { useTheme } from '../ui/ThemeProvider';
import type { Palette } from '../ui/theme';

/**
 * One slim strip with both required messages: the demo notice and the movement caution line. Used on the question screen, where
 * the two separate banners would take too much height. The amber background and the warning icon stay, so the caution is as
 * visible as before.
 */
export function DemoCautionStrip() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  return (
    <View style={styles.strip} accessibilityRole="alert">
      <Ionicons name="warning-outline" size={18} color={colors.caution} />
      <View style={styles.texts}>
        <AppText variant="secondary" color={colors.text} style={styles.demo} numberOfLines={1}>
          {t('demoBanner')}
        </AppText>
        <AppText variant="secondary" color={colors.caution} style={styles.caution}>
          {t('moveSafely')}
        </AppText>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: colors.cautionTint, borderBottomWidth: 1, borderBottomColor: colors.line },
  texts: { flex: 1 },
  demo: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  caution: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
});
