import { Redirect, router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { Screen } from '../../components/Screen';
import type { TKey } from '../../i18n';
import { regionLabelKey } from '../../regions/shoulder';
import { useSession } from '../../store/session';
import type { Depth } from '../../store/session';
import { useT } from '../../store/settings';
import { colors, spacing } from '../../theme';

const DEPTHS: { depth: Depth; label: TKey }[] = [
  { depth: 'surface', label: 'confirm.surface' },
  { depth: 'middle', label: 'confirm.middle' },
  { depth: 'deep', label: 'confirm.deep' },
];

export default function Confirm() {
  const t = useT();
  const { regionId, depth, setDepth } = useSession();
  const labelKey = regionId ? regionLabelKey(regionId) : null;
  if (!labelKey) return <Redirect href="/report/body" />;

  return (
    <Screen title={t('confirm.title')} onBack={() => router.back()}>
      <Card tone="mint">
        <AppText variant="h1" color={colors.navy}>
          {t('confirm.youSelected', { region: t(labelKey) })}
        </AppText>
      </Card>

      <AppText variant="h2" color={colors.navy}>
        {t('confirm.depthTitle')}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {DEPTHS.map((d) => (
          <Chip
            key={d.depth}
            label={t(d.label)}
            selected={depth === d.depth}
            onPress={() => setDepth(d.depth)}
          />
        ))}
      </View>

      <Button label={t('confirm.yes')} onPress={() => router.push('/report/questions')} />
      <Button label={t('common.change')} variant="outline" onPress={() => router.back()} />
    </Screen>
  );
}
