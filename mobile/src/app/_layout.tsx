import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner } from '../components/Banner';
import { useChrome } from '../store/chrome';
import { useSettings } from '../store/settings';
import { colors } from '../theme';

// Development builds print these two warnings from the three.js library on every start. They need no action and they cover the
// buttons at the bottom of the screen while testing, so they are not shown in the on-screen log (they stay in the Metro log).
if (__DEV__) LogBox.ignoreLogs(['THREE.Clock: This module has been deprecated', 'THREE.WebGLRenderer: WEBGL_lose_context']);

function Shell() {
  const insets = useSafeAreaInsets();
  const offline = useSettings((s) => s.offline);
  const compact = useChrome((s) => s.compact);
  return (
    <View style={styles.root}>
      {/* The demo strip sits above the navigator, so it shows on every screen. */}
      <View style={{ paddingTop: insets.top, backgroundColor: colors.neutralTint }}>
        {compact ? null : <Banner kind="demo" />}
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
