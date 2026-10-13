import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Action, Page, styles } from '../components/SafetyUI';
import { GateOutput } from '../gate/evaluate';
import { openIntakeStore } from '../storage/nativeStore';

export default function GateResult() {
  const params = useLocalSearchParams<{ intakeId?: string | string[] }>();
  const id = typeof params.intakeId === 'string' ? params.intakeId : '';
  const [gate, setGate] = useState<GateOutput | null>(null);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    setGate(null); setError('');
    void openIntakeStore().then((store) => store.savedGate(id))
      .then((result) => { if (active) setGate(result); })
      .catch(() => { if (active) setError('Safety results could not be verified. Seek clinical help if you are concerned.'); });
    return () => { active = false; };
  }, [id]));
  return <Page>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {gate?.verdict === 'RED_FLAG' && <>
      <Text accessibilityRole="header" style={styles.heading}>Please seek clinical help.</Text>
      <Text style={styles.body}>An answer needs clinical attention, or a safety concern remains unclear. Stop movement checks and contact a clinician promptly.</Text>
      <Text style={styles.body}>For chest pressure, difficulty breathing, or a medical emergency, contact local emergency services now.</Text>
    </>}
    {gate?.verdict === 'CLARIFY' && <>
      <Text style={styles.heading}>We need a little more information.</Text>
      <Text style={styles.body}>Your safety screen is incomplete or an answer needs clarification.</Text>
      <Action title="Continue safety questions" onPress={() => router.replace({ pathname: '/questions', params: { intakeId: id } })} />
    </>}
    {gate?.verdict === 'SAFE' && <>
      <Text style={styles.heading}>Safety screen complete.</Text>
      <Text style={styles.body}>No draft gate rule was triggered. This does not rule out a medical problem. Contact a clinician if symptoms concern you or change.</Text>
      <Text style={styles.caption}>This standalone demo ends here. Movement checks and care options will be connected by the team.</Text>
    </>}
    {!gate && !error && <Text style={styles.body}>Checking saved answers…</Text>}
    <Action title="Back to start" secondary onPress={() => router.replace('/')} />
  </Page>;
}
