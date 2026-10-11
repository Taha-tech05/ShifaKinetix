import { Stack } from 'expo-router';
import { colors } from '../../theme';

/**
 * Report a Symptom flow: its own full-screen stack, so no bottom tab bar.
 * Each screen draws its own visible back arrow in ScreenHeader.
 */
export default function ReportLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
