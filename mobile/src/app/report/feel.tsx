import { Redirect } from 'expo-router';
import { SafeGuard } from '../../flow/SafeGuard';

/**
 * "What did you feel?" now lives on the live screen (movement.tsx), under the model, with tap-to-answer chips. This route
 * is kept so older links still work. Only after the verdict SAFE.
 */
export default function FeelScreen() {
  return (
    <SafeGuard>
      <Redirect href="/report/movement" />
    </SafeGuard>
  );
}
