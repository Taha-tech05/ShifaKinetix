// Narrowing/UI unit tests inject a gate outcome. Real safety + persistence are covered
// without this fixture by safetyIntegration.test.tsx and the SQLite suite.
import { Redirect } from 'expo-router';
import { useSession } from '../../src/store/session';
import { routeAfterGate } from '../../src/flow/intake';
export function FixtureSafeGuard({ children }: { children: React.ReactNode }) {
  const verdict = useSession((s) => s.gateVerdict);
  const done = useSession((s) => s.reaskDone);
  if (verdict === 'SAFE') return <>{children}</>;
  return <Redirect href={(verdict ? routeAfterGate(verdict, done) : '/report/danger') as never} />;
}
