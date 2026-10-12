import { router } from 'expo-router';
import { FullProjectPlaceholder } from '../../screens/FullProjectPlaceholder';
import { useT } from '../../store/settings';

/** Stub: talking to a doctor is part of the full project. */
export default function Doctor() {
  const t = useT();
  return <FullProjectPlaceholder title={t('choice.doctor')} onBack={() => router.back()} />;
}
