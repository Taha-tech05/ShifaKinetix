import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from './AppText';
import { useMemo } from 'react';
import { useTheme } from '../ui/ThemeProvider';
import type { Palette } from '../ui/theme';

/** Amber strip under the top bar (design .mstrip). Every movement screen carries the caution line. */
export function CautionStrip({ text }: { text: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.strip} accessibilityRole="alert">
      <Ionicons name="warning-outline" size={22} color={colors.caution} />
      <AppText variant="secondary" color={colors.caution} style={styles.text}>
        {text}
      </AppText>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.cautionTint,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  text: { flex: 1, fontWeight: '600' },
});
