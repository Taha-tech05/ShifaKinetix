import { Redirect } from 'expo-router';
import { useSession } from '../store/session';
import { isSafe, routeAfterGate } from './intake';

/**
 * Wraps every screen that is only for a SAFE verdict (movements, follow-up questions, result, advice).
 * Without the verdict SAFE it sends the patient back to where the verdict leads, and renders nothing else.
 */
export function SafeGuard({ children }: { children: React.ReactNode }) {
  const verdict = useSession((s) => s.gateVerdict);
  const reaskDone = useSession((s) => s.reaskDone);
  if (isSafe(verdict)) return <>{children}</>;
  if (verdict === null) return <Redirect href="/report/danger" />;
  return <Redirect href={routeAfterGate(verdict, reaskDone) as never} />;
}
