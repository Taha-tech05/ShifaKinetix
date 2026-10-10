import { router } from 'expo-router';
import { FullProjectPlaceholder } from '../screens/FullProjectPlaceholder';
import { useT } from '../store/settings';

export default function Book() {
  const t = useT();
  return <FullProjectPlaceholder title={t('home.book')} onBack={() => router.back()} />;
}
