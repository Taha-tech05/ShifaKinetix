import { Redirect, router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { BodyViewer } from '../../components/BodyViewer';
import { Button } from '../../components/Button';
import { IconTile } from '../../components/IconTile';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { StepProgress } from '../../components/StepProgress';
import { highlightNamesFor } from '../../regions/regionMap';
import { regionLabel, selectionKey } from '../../regions/shoulder';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { colors, radius, shadows } from '../../theme';

/**
 * P5 (design): body with tappable spots and a bottom sheet showing the selected spot and Next.
 * Exact mode highlights only the structure under the finger. Region mode highlights the whole area (every structure
 * of that side and sub-region in the active layer).
 */
export default function Body() {
  const t = useT();
  const mode = useSession((s) => s.mode);
  const selection = useSession((s) => s.selection);
  const setSelection = useSession((s) => s.setSelection);
  const label = selection ? regionLabel(selection.regionId, selection.subRegionId) : null;
  const highlightNames = useMemo(() => (mode ? highlightNamesFor(selection, mode) : []), [mode, selection]);
  if (!mode) return <Redirect href="/report/fork" />;

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
            {label ?? '—'}
          </AppText>
        </View>
        {label ? <StatusChip status="unknown" label={t('body.selected')} /> : null}
      </View>
      <Button label={t('common.next')} disabled={!label} onPress={() => router.push('/report/confirm')} />
      <AppText variant="secondary" color={colors.muted} style={styles.hint}>
        {label ? t('body.tapToChange') : t('body.tapToChoose')}
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
        highlightedIds={selection ? [selectionKey(selection.regionId, selection.subRegionId)] : []}
        highlightNames={highlightNames}
        // A selection made in one layer is cleared when the layer changes, so the sheet never shows a stale structure.
        onLayerChange={() => setSelection(null)}
        onSelect={setSelection}
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
