import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Page({ children }: { children: ReactNode }) {
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.brand}>SHIFAKINETIX · SHOULDER</Text>
    <View style={styles.banner}><Text style={styles.bannerText}>Demo only, not for real patients.</Text>
      <Text style={styles.bannerText}>Draft, awaiting clinician review.</Text></View>
    {children}
  </ScrollView></SafeAreaView>;
}
export function Action({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, (disabled || pressed) && styles.dim]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F6F5' },
  content: { padding: 24, gap: 16, maxWidth: 700, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  brand: { color: '#24685C', fontWeight: '700', letterSpacing: 1, fontSize: 13 },
  banner: { backgroundColor: '#FFF1D3', padding: 14, borderRadius: 12, gap: 4 },
  bannerText: { color: '#694500', fontSize: 14 },
  heading: { fontSize: 28, fontWeight: '700', color: '#163C35' },
  body: { fontSize: 18, lineHeight: 27, color: '#25463E' },
  caption: { fontSize: 14, color: '#53675F', lineHeight: 21 },
  error: { fontSize: 17, color: '#A12424', lineHeight: 25 },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, gap: 12 },
  button: { backgroundColor: '#176756', padding: 18, minHeight: 58, borderRadius: 12, justifyContent: 'center' },
  secondary: { backgroundColor: '#DFEBE6', borderWidth: 1, borderColor: '#ABC5BB' },
  buttonText: { color: '#FFFFFF', fontSize: 19, fontWeight: '600', textAlign: 'center' },
  secondaryText: { color: '#174E40' },
  dim: { opacity: 0.5 },
  input: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#789D8D', fontSize: 22, color: '#163C35' },
});
