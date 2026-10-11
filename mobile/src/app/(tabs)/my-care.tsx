import { FullProjectPlaceholder } from '../../screens/FullProjectPlaceholder';
import { useT } from '../../store/settings';

export default function MyCare() {
  const t = useT();
  return <FullProjectPlaceholder title={t('myCare.title')} />;
}
