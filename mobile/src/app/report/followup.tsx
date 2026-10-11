import { Redirect } from 'expo-router';
import { SafeGuard } from '../../flow/SafeGuard';

/**
 * The follow-up questions now live on the live screen (movement.tsx): one idea per question, tap-to-answer chips, the
 * narrowing and the gate updated after every answer. This route is kept so exact mode and older links still work.
 * Only after the verdict SAFE.
 */
export default function FollowUp() {
  return (
    <SafeGuard>
      <Redirect href="/report/movement" />
    </SafeGuard>
  );
}
