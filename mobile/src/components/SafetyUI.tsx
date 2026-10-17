import { ReactNode, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientBackground } from '../ui/GradientBackground';
import { useTheme } from '../ui/ThemeProvider';
import { softShadow } from '../ui/theme';
import type { Palette } from '../ui/theme';

/** Styles of the plain standalone safety pages. A hook, because the colours follow the light or dark theme. */
export function useSafetyStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

export function Page({ children }: { children: ReactNode }) {
  const styles = useSafetyStyles();
  return <SafeAreaView style={styles.page}>
    <GradientBackground />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.brand}>SHIFAKINETIX · SHOULDER</Text>
    <View style={styles.banner}><Text style={styles.bannerText}>Demo only, not for real patients.</Text>
      <Text style={styles.bannerText}>Draft, awaiting clinician review.</Text></View>
    {children}
  </ScrollView></SafeAreaView>;
}
export function Action({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  const styles = useSafetyStyles();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, (disabled || pressed) && styles.dim]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: 24, gap: 16, maxWidth: 700, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  brand: { color: colors.accentText, fontWeight: '700', letterSpacing: 1, fontSize: 14 },
  banner: { backgroundColor: colors.cautionTint, padding: 14, borderRadius: 20, gap: 4, borderWidth: 1, borderColor: colors.glassBorder },
  bannerText: { color: colors.caution, fontSize: 14, fontWeight: '600' },
  heading: { fontSize: 24, lineHeight: 32, fontWeight: '800', color: colors.text },
  body: { fontSize: 16, lineHeight: 24, color: colors.text },
  caption: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  error: { fontSize: 16, color: colors.caution, lineHeight: 24, fontWeight: '700' },
  card: { backgroundColor: colors.cardFill, padding: 20, borderRadius: 24, gap: 12, borderWidth: 1, borderColor: colors.glassBorder, ...softShadow(colors) },
  button: { backgroundColor: colors.accentFill, padding: 18, minHeight: 56, borderRadius: 24, justifyContent: 'center' },
  secondary: { backgroundColor: colors.glassFill, borderWidth: 1.5, borderColor: colors.lineStrong },
  buttonText: { color: colors.onAccent, fontSize: 16, lineHeight: 24, fontWeight: '700', textAlign: 'center' },
  secondaryText: { color: colors.text },
  dim: { opacity: 0.5 },
  input: { backgroundColor: colors.surface, padding: 16, borderRadius: 20, borderWidth: 1.5, borderColor: colors.lineStrong, fontSize: 20, color: colors.text },
});
