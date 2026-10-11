import { Redirect } from 'expo-router';
import { useSettings } from '../store/settings';

/** Entry gate: language, then sign-in, then consent, then Home. */
export default function Index() {
  const { language, signedIn, consented } = useSettings();
  if (!language) return <Redirect href="/language" />;
  if (!signedIn) return <Redirect href="/login" />;
  if (!consented) return <Redirect href="/consent" />;
  return <Redirect href="/home" />;
}
