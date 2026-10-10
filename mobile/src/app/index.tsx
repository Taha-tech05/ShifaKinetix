import { useCallback, useRef, useState } from 'react';
import { Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { Action, Page, styles } from '../components/SafetyUI';
import { openIntakeStore } from '../storage/nativeStore';

export default function SafetyHome() {
  const [latest, setLatest] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const starting = useRef(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setReady(false);
    void openIntakeStore().then(async (store) => {
      await store.cachedQuestions();
      const id = await store.latestIntake();
      const queue = await store.pending();
      if (active) { setLatest(id); setPending(queue.length); setError(''); setReady(true); }
    }).catch(() => { if (active) setError('Local storage could not be opened. Restart the app to try again.'); });
    return () => { active = false; };
  }, []));
  async function start() {
    if (starting.current) return;
    starting.current = true;
    try {
      const store = await openIntakeStore();
      const id = await store.createIntake(randomUUID());
      router.push({ pathname: '/questions', params: { intakeId: id } });
    } catch { setError('Could not save a new intake. Please try again.'); }
    finally { starting.current = false; }
  }
  return <Page>
    <Text style={styles.heading}>Start with safety.</Text>
    <Text style={styles.body}>Answer a few shoulder questions before any movement checks. You can always choose Not sure.</Text>
    <Text style={styles.caption}>Your answers save on this device, including without internet. Use fictional answers for this demo.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Action title="Start a new shoulder intake" disabled={!ready} onPress={() => { void start(); }} />
    {latest && <Action title="Resume saved intake" disabled={!ready} secondary
      onPress={() => router.push({ pathname: '/questions', params: { intakeId: latest } })} />}
    <Text style={styles.caption}>{pending} saved updates waiting to send. Server connection is not enabled in this demo.</Text>
  </Page>;
}
