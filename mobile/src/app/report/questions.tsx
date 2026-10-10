import { router } from 'expo-router';
import { FullProjectPlaceholder } from '../../screens/FullProjectPlaceholder';

export default function Questions() {
  return <FullProjectPlaceholder onBack={() => router.back()} />;
}
