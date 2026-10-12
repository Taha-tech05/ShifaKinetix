import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { BodyFigure } from '../../components/BodyFigure';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { IconTile } from '../../components/IconTile';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { StepProgress } from '../../components/StepProgress';
import { regionLabel } from '../../regions/shoulder';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { colors } from '../../theme';

/**
 * P6 (design): preview with marker, "You selected" card, Yes this is right, Change.
 * The card shows side and sub-region. The small line names the closest structure under the finger as a hint,
 * and the note says this is where the patient tapped, not a diagnosis.
 */
export default function Confirm() {
  const t = useT();
  const selection = useSession((s) => s.selection);
  const label = selection ? regionLabel(selection.regionId, selection.subRegionId) : null;
  if (!selection || !label) return <Redirect href="/report/body" />;

  const hit = selection.hitStructure;
  const hint = hit ? t(hit.kind === 'bone' ? 'confirm.closestBone' : 'confirm.closestSurface', { name: hit.name }) : null;

  // Marker sits on the selected shoulder. Facing the viewer, patient-right is on the viewer's left.
  const right = selection.regionId === 'shoulder_right';
  const back = selection.subRegionId === 'back' || selection.subRegionId === 'scapular';
  const markerX = right === !back ? 22 : 78;

  return (
    <Screen
      onBack={() => router.back()}
      footer={
        <>
          <Button label={t('confirm.yes')} onPress={() => router.push('/report/basics')} />
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
          {hint ? (
            <AppText variant="secondary" color={colors.muted}>
              {hint}
            </AppText>
          ) : null}
        </View>
        <StatusChip status="safe" label={t('body.selected')} />
      </Card>
      <AppText variant="secondary" color={colors.muted}>
        {t('confirm.notDiagnosis')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  col: { flex: 1 },
});
