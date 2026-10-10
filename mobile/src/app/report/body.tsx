import { router } from 'expo-router';
import { AppText } from '../../components/AppText';
import { BodyViewer } from '../../components/BodyViewer';
import { Screen } from '../../components/Screen';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { colors } from '../../theme';

export default function Body() {
  const t = useT();
  const regionId = useSession((s) => s.regionId);
  const setRegion = useSession((s) => s.setRegion);
  return (
    <Screen title={t('body.title')} onBack={() => router.back()}>
      <AppText variant="h1" color={colors.navy}>
        {t('body.title')}
      </AppText>
      <AppText variant="body" color={colors.muted}>
        {t('body.subtitle')}
      </AppText>
      <BodyViewer
        highlightedIds={regionId ? [regionId] : []}
        onSelect={({ regionId: id, point }) => {
          setRegion(id, point);
          router.push('/report/confirm');
        }}
      />
    </Screen>
  );
}
