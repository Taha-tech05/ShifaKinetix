import { router } from 'expo-router';
import { SafeGuard } from '../../flow/SafeGuard';
import { FullProjectPlaceholder } from '../../screens/FullProjectPlaceholder';
import { useT } from '../../store/settings';

/** Stub: the AI assistant is part of the full project. Only reachable after the verdict SAFE. */
export default function Assistant() {
  const t = useT();
  return (
    <SafeGuard>
      <FullProjectPlaceholder title={t('choice.assistant')} onBack={() => router.back()} />
    </SafeGuard>
  );
}
