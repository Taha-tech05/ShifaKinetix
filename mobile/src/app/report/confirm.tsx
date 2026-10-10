import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { BodyFigure } from '../../components/BodyFigure';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { IconTile } from '../../components/IconTile';
import { Screen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { StatusChip } from '../../components/StatusChip';
import { StepProgress } from '../../components/StepProgress';
import { regionLabelKey } from '../../regions/shoulder';
import { useSession } from '../../store/session';
import type { Depth } from '../../store/session';
import { useT } from '../../store/settings';
import { colors } from '../../theme';

/** P6 (design): preview with marker, "You selected" card, optional depth, Yes this is right, Change. */
export default function Confirm() {
  const t = useT();
  const { regionId, depth, setDepth } = useSession();
  const labelKey = regionId ? regionLabelKey(regionId) : null;
  if (!labelKey) return <Redirect href="/report/body" />;

  const label = t(labelKey);
  const right = regionId?.includes('_right_');
  const back = regionId?.includes('_back');
  // Marker sits on the selected shoulder. Facing the viewer, patient-right is on the viewer's left.
  const markerX = (right ? 1 : 0) === (back ? 1 : 0) ? 78 : 22;

  const depths: { value: Depth; label: string }[] = [
    { value: 'surface', label: t('confirm.surface') },
    { value: 'middle', label: t('confirm.middle') },
    { value: 'deep', label: t('confirm.deep') },
  ];

  return (
    <Screen
      onBack={() => router.back()}
      footer={
        <>
          <Button label={t('confirm.yes')} onPress={() => router.push('/report/questions')} />
          <Button variant="text" label={t('common.change')} onPress={() => router.back()} />
        </>
      }
    >
      <StepProgress step={1} total={5} />
      <BodyFigure height={250} marker={{ x: markerX, y: 22 }} />
      <Card row accessibilityLabel={`${t('confirm.selectedLabel')}: ${label}`}>
        <IconTile icon="locate-outline" tone="danger" />
        <View style={styles.col}>
          <AppText variant="secondary" color={colors.muted}>
            {t('confirm.selectedLabel')}
          </AppText>
          <AppText variant="h2" color={colors.navy}>
            {label}
          </AppText>
        </View>
        <StatusChip status="safe" label={t('body.selected')} />
      </Card>
      <View style={styles.depth}>
        <AppText variant="secondary" color={colors.muted} style={styles.bold}>
          {t('confirm.depthTitle')} <AppText variant="secondary" color={colors.muted}>{t('confirm.optional')}</AppText>
        </AppText>
        <Segmented options={depths} value={depth} onChange={setDepth} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  col: { flex: 1 },
  depth: { gap: 6 },
  bold: { fontWeight: '600' },
});
