import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../components/AppText';
import { Screen } from '../components/Screen';
import { colors, radius, spacing } from '../theme';

export const DEMO_NOTE = 'Demo only, not for real patients.';

/** Every server screen: the standard screen plus the demo notice in the page itself, so it is there whatever the app shell shows. */
export function ServerScreen({ title, children, footer, onBack }: { title: string; children: React.ReactNode; footer?: React.ReactNode; onBack?: () => void }) {
  return (
    <Screen onBack={onBack ?? (() => router.back())} footer={footer}>
      <View accessibilityRole="alert" style={styles.demo}>
        <AppText variant="secondary" color={colors.navy} style={styles.demoText}>{DEMO_NOTE}</AppText>
      </View>
      <AppText variant="h1" color={colors.navy}>{title}</AppText>
      {children}
    </Screen>
  );
}

/** A failure the user must see; never styled or worded as a result. */
export function Problem({ text }: { text: string }) {
  return text ? (
    <View accessibilityRole="alert" style={styles.problem}>
      <AppText variant="bodyStrong" color={colors.danger}>{text}</AppText>
    </View>
  ) : null;
}

const styles = StyleSheet.create({
  demo: { backgroundColor: colors.cautionTint, borderRadius: radius.card, padding: spacing.md },
  demoText: { fontWeight: '700' },
  problem: { borderRadius: radius.card, padding: spacing.md, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.danger },
});
