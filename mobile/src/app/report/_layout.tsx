import { Stack, useSegments } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SceneHost } from '../../ui/SceneHost';
import { SceneHostContext } from '../../ui/scene';
import { ThemeScope, useTheme } from '../../ui/ThemeProvider';

/** Routes of the symptom flow that live on the dark 3D screen: one persistent body and one glass sheet. */
const SCENE_ROUTES = new Set(['intro', 'fork', 'body', 'confirm', 'basics', 'danger', 'reask', 'safe', 'movement', 'result', 'urgent', 'unclear']);

/**
 * Report a Symptom flow: its own full-screen stack, so no bottom tab bar.
 * For the scene routes the 3D body and the chat sheet are mounted here, once, so they stay put while the route changes inside
 * the sheet. The other routes (intro, fork, result...) are ordinary screens. The scene routes are always dark, in both app modes.
 */
export default function ReportLayout() {
  const segments = useSegments() as string[];
  const leaf = segments[segments.length - 1] ?? '';
  const inScene = SCENE_ROUTES.has(leaf);
  const app = useTheme();
  return (
    <ThemeScope scheme={app.scheme}>
      <SceneHostContext.Provider value={true}>
        <View style={styles.fill}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: inScene ? 'none' : 'default',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          {/* on top of the stack: the scene routes draw nothing themselves, they hand their content to the sheet */}
          {inScene ? <SceneHost leaf={leaf} /> : null}
        </View>
      </SceneHostContext.Provider>
    </ThemeScope>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
