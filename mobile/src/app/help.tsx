import { router } from 'expo-router';
import { FullProjectPlaceholder } from '../screens/FullProjectPlaceholder';
import { useT } from '../store/settings';

export default function Help() {
  const t = useT();
  return <FullProjectPlaceholder title={t('home.tileHelp')} onBack={() => router.back()} />;
}
