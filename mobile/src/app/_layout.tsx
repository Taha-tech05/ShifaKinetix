import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner } from '../components/Banner';
import { useChrome } from '../store/chrome';
import { useSettings } from '../store/settings';
import { ThemeProvider, useTheme } from '../ui/ThemeProvider';

// Development builds print these two warnings from the three.js library on every start. They need no action and they cover the
// buttons at the bottom of the screen while testing, so they are not shown in the on-screen log (they stay in the Metro log).
if (__DEV__) LogBox.ignoreLogs(['THREE.Clock: This module has been deprecated', 'THREE.WebGLRenderer: WEBGL_lose_context']);

function Shell() {
  const insets = useSafeAreaInsets();
  const offline = useSettings((s) => s.offline);
  const compact = useChrome((s) => s.compact);
  const { colors, scheme } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.page }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/* The demo strip sits above the navigator, so it shows on every screen. The symptom screen is full screen: it has no strip
          (its demo notice is the first message of its chat) and draws under the status bar itself. */}
      {compact ? null : (
        <View style={{ paddingTop: insets.top, backgroundColor: colors.cautionTint }}>
          <Banner kind="demo" />
        </View>
      )}
      {offline ? <Banner kind="offline" /> : null}
      <View style={styles.fill}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }} />
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
});
