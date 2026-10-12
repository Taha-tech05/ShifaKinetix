import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppText } from '../components/AppText';
import { openSafetySession, safetyFingerprint } from '../gate/safetySession';
import { useSession } from '../store/session';
import { isSafe, routeAfterGate } from './intake';

/**
 * Wraps every screen that is only for a SAFE verdict (movements, follow-up questions, result, advice).
 * Without the verdict SAFE it sends the patient back to where the verdict leads, and renders nothing else.
 */
export function SafeGuard({ children }: { children: React.ReactNode }) {
  const verdict = useSession((s) => s.gateVerdict);
  const reaskDone = useSession((s) => s.reaskDone);
  const fingerprint = useSession(safetyFingerprint);
  const answers = useSession((s) => s.answers);
  const movements = useSession((s) => s.movementResults);
  const selection = useSession((s) => s.selection);
  const [confirmed, setConfirmed] = useState<{ fingerprint: string; answers: typeof answers; movements: typeof movements; selection: typeof selection } | null>(null);
  const [error, setError] = useState('');
  // A live edit deliberately invalidates SAFE before its async checkpoint finishes.
  // Only a previously verified assessment may wait here; an unverified direct link
  // or a changed selection must still return to the safety questionnaire.
  const rechecking = verdict === null && confirmed !== null && selection !== null
    && confirmed.selection === selection;
  useEffect(() => {
    let active = true;
    if (verdict === 'SAFE' || rechecking) void openSafetySession().then((s) => s.checkpoint()).then((out) => {
      if (active && out.verdict === 'SAFE') { setConfirmed({ fingerprint, answers, movements, selection }); setError(''); }
    }).catch(() => { if (active) setError('Saved safety answers could not be verified. Return to the safety check.'); });
    return () => { active = false; };
  }, [fingerprint, verdict, answers, movements, selection, rechecking]);
  if (error) return <Redirect href="/report/danger" />;
  if (rechecking) return <AppText>Saving and verifying safety answers…</AppText>;
  if (isSafe(verdict)) return confirmed && confirmed.fingerprint === fingerprint && confirmed.answers === answers
    && confirmed.movements === movements && confirmed.selection === selection
    ? <>{children}</> : <AppText>Verifying saved safety answers…</AppText>;
  if (verdict === null) return <Redirect href="/report/danger" />;
  return <Redirect href={routeAfterGate(verdict, reaskDone) as never} />;
}
