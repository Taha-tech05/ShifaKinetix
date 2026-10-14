import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { colors, radius, spacing } from '../theme';
import { useServer } from './connection';
import { autoUploadEnabled } from './defaults';
import { savedAssessment, uploadSavedAssessment } from './uploadAssessment';
import type { UploadDeps } from './uploadAssessment';

export type AutoUploadResult = { ok: true; intakeId: string } | { ok: false; message: string };

const NOT_UPLOADED = 'Your answers are saved on this phone but were not sent to the server, so a doctor cannot see them yet.';

/**
 * The end of the safety flow, with no tapping: make sure a patient account is signed in (the fixed demo account if nobody is),
 * upload the saved assessment, and report whether the server confirmed every event. Never throws: every failure is a message.
 */
export async function autoUploadAssessment(isCurrent: () => boolean = () => true, deps?: UploadDeps): Promise<AutoUploadResult> {
  try {
    if (useServer.getState().identity?.role !== 'patient') await useServer.getState().signInDemo('patient');
    const { api, identity, error } = useServer.getState();
    if (!api || identity?.role !== 'patient') return { ok: false, message: `${error || 'Could not sign in to the server.'} ${NOT_UPLOADED}` };
    const { intakeId } = await savedAssessment(deps);
    if (!intakeId) return { ok: false, message: 'There is no saved assessment to send yet.' };
    const result = await uploadSavedAssessment(api, identity, intakeId, isCurrent, deps);
    if (result.remaining > 0) return { ok: false, message: `${result.remaining} saved answer(s) were not confirmed by the server. ${NOT_UPLOADED}` };
    useServer.getState().rememberIntake(intakeId);
    return { ok: true, intakeId };
  } catch (e) {
    return { ok: false, message: `${e instanceof Error && e.message ? e.message : 'The upload failed.'} ${NOT_UPLOADED}` };
  }
}

/**
 * Put this on the screens where the safety flow ends (urgent, unclear, result). It uploads once, then opens the server report.
 * If anything fails it stays on the current screen and says so, with a retry; it never shows a result of its own.
 */
export function AutoUploadNotice() {
  const [state, setState] = useState<{ phase: 'working' } | { phase: 'failed'; message: string } | { phase: 'off' }>(
    autoUploadEnabled() ? { phase: 'working' } : { phase: 'off' },
  );
  const started = useRef(false);
  const alive = useRef(true);

  const run = useCallback(async () => {
    setState({ phase: 'working' });
    const result = await autoUploadAssessment(() => alive.current);
    if (!alive.current) return;
    if (result.ok) {
      setState({ phase: 'off' });
      router.push('/server/report' as never);
    } else {
      setState({ phase: 'failed', message: result.message });
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    if (autoUploadEnabled() && !started.current) {
      started.current = true;
      void run();
    }
    return () => { alive.current = false; };
  }, [run]);

  if (state.phase === 'off') return null;
  return (
    <View accessibilityRole="alert" style={[styles.box, state.phase === 'failed' && styles.failed]}>
      {state.phase === 'working' ? (
        <AppText variant="secondary" color={colors.navy}>Sending your answers to the server…</AppText>
      ) : (
        <>
          <AppText variant="bodyStrong" color={colors.danger}>Not sent to the server</AppText>
          <AppText variant="secondary" color={colors.navy}>{state.message}</AppText>
          <Button label="Try again" variant="outline" onPress={() => void run()} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.card, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  failed: { borderColor: colors.danger, borderWidth: 2 },
});
