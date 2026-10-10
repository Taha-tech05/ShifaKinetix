import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function SafetyLayout() {
  return <SafeAreaProvider><Stack screenOptions={{ headerTitle: 'Shoulder safety demo', headerBackButtonDisplayMode: 'minimal' }}>
    <Stack.Screen name="index" options={{ title: 'ShifaKinetix' }} />
    <Stack.Screen name="questions" options={{ title: 'Safety questions' }} />
    <Stack.Screen name="result" options={{ title: 'Next steps' }} />
  </Stack></SafeAreaProvider>;
}
