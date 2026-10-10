import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { BodyViewer } from '../../components/BodyViewer';
import { Button } from '../../components/Button';
import { IconTile } from '../../components/IconTile';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { StepProgress } from '../../components/StepProgress';
import { regionLabelKey } from '../../regions/shoulder';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { colors, radius, shadows } from '../../theme';

/** P5 (design): body with tappable spots and a bottom sheet showing the selected spot and Next. */
export default function Body() {
  const t = useT();
  const regionId = useSession((s) => s.regionId);
  const setRegion = useSession((s) => s.setRegion);
  const labelKey = regionId ? regionLabelKey(regionId) : null;

  const sheet = (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.selRow}>
        <IconTile icon="locate-outline" tone="danger" />
        <View style={styles.col}>
          <AppText variant="secondary" color={colors.muted}>
            {t('body.selectedSpot')}
          </AppText>
          <AppText variant="h2" color={colors.navy}>
            {labelKey ? t(labelKey) : '—'}
          </AppText>
        </View>
        {labelKey ? <StatusChip status="unknown" label={t('body.selected')} /> : null}
      </View>
      <Button label={t('common.next')} disabled={!labelKey} onPress={() => router.push('/report/confirm')} />
      <AppText variant="secondary" color={colors.muted} style={styles.hint}>
        {labelKey ? t('body.tapToChange') : t('body.tapToChoose')}
      </AppText>
    </View>
  );

  return (
    <Screen scroll={false} onBack={() => router.back()} footer={sheet} bareFooter>
      <StepProgress step={1} total={5} />
      <AppText variant="h1" color={colors.navy}>
        {t('body.title')}
      </AppText>
      <BodyViewer
        highlightedIds={regionId ? [regionId] : []}
        onSelect={({ regionId: id, point }) => setRegion(id, point)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.white,
    borderTopStartRadius: radius.sheet,
    borderTopEndRadius: radius.sheet,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 12,
    ...shadows.raised,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong },
  selRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  col: { flex: 1 },
  hint: { textAlign: 'center' },
});
