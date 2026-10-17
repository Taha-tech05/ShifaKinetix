import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../components/AppText';
import { Screen } from '../components/Screen';
import { radius, spacing } from '../theme';
import { useServer } from './connection';
import { useMemo } from 'react';
import { useTheme } from '../ui/ThemeProvider';
import type { Palette } from '../ui/theme';

export const DEMO_NOTE = 'Demo only, not for real patients.';

/** Every server screen: the standard screen plus the demo notice in the page itself, so it is there whatever the app shell shows. */
export function ServerScreen({ title, children, footer, onBack }: { title: string; children: React.ReactNode; footer?: React.ReactNode; onBack?: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const role = useServer((st) => st.identity?.role);
  return (
    <Screen onBack={onBack ?? (() => router.back())} footer={footer} roleLabel={role === 'doctor' ? 'Doctor' : undefined}>
      <View accessibilityRole="alert" style={styles.demo}>
        <AppText variant="secondary" color={colors.text} style={styles.demoText}>{DEMO_NOTE}</AppText>
      </View>
      <AppText variant="h1" color={colors.text}>{title}</AppText>
      {children}
    </Screen>
  );
}

/** A failure the user must see; never styled or worded as a result. */
export function Problem({ text }: { text: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return text ? (
    <View accessibilityRole="alert" style={styles.problem}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <Ionicons name="warning-outline" size={20} color={colors.caution} />
        <AppText variant="bodyStrong" color={colors.caution} style={{ flex: 1 }}>{text}</AppText>
      </View>
    </View>
  ) : null;
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  demo: { backgroundColor: colors.cautionTint, borderRadius: radius.card, padding: spacing.md },
  demoText: { fontWeight: '700' },
  problem: { borderRadius: radius.card, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.cautionBase },
});
