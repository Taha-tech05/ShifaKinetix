import { router } from 'expo-router';
import { FullProjectPlaceholder } from '../../screens/FullProjectPlaceholder';

export default function Movement() {
  return <FullProjectPlaceholder movement onBack={() => router.back()} />;
}
