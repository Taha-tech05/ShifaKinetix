import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner } from '../components/Banner';
import { useSettings } from '../store/settings';
import { colors } from '../theme';

function Shell() {
  const insets = useSafeAreaInsets();
  const offline = useSettings((s) => s.offline);
  return (
    <View style={styles.root}>
      {/* The demo strip sits above the navigator, so it shows on every screen. */}
      <View style={{ paddingTop: insets.top, backgroundColor: colors.neutralTint }}>
        <Banner kind="demo" />
      </View>
      {offline ? <Banner kind="offline" /> : null}
      <View style={styles.fill}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }} />
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Shell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  fill: { flex: 1 },
});
