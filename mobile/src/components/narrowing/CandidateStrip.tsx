import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import type { LiveCategory, LiveState } from '../../narrowing/live';
import { REGION_MAP } from '../../regions/regionMap';
import { useT } from '../../store/settings';
import { colors, radius } from '../../theme';
import { AppText } from '../AppText';
import { MatchBar } from './MatchBar';

/** The name of a structure category in the current language. */
export function useCategoryName() {
  const t = useT();
  return (c: LiveCategory['category'] | 'UNCLEAR') => t(`live.category.${c}` as const);
}

/** The categories with a band and a match bar (no numbers, no ranks). */
export function CategoryRows({ categories }: { categories: LiveCategory[] }) {
  const t = useT();
  const name = useCategoryName();
  return (
    <>
      {categories.map((c) => (
        <View key={c.category} style={styles.row}>
          <View style={styles.rowTop}>
            <AppText variant="bodyStrong" color={colors.navy} style={styles.name} numberOfLines={2}>
              {name(c.category)}
            </AppText>
            <View style={[styles.band, c.band === 'higher' ? styles.bandHigher : c.band === 'moderate' ? styles.bandModerate : styles.bandLow]}>
              <AppText variant="secondary" color={colors.navy} style={styles.bold}>
                {t(`live.band.${c.band}` as const)}
              </AppText>
            </View>
          </View>
          <MatchBar strength={c.strength} band={c.band} />
        </View>
      ))}
    </>
  );
}

export const muscleName = (id: string) => REGION_MAP.structures[id]?.name ?? id;

/** "Not a diagnosis" and "Estimate": on every place that shows narrowing output. */
export function NarrowingChips() {
  const t = useT();
  return (
    <View style={styles.chips}>
      <View style={[styles.chip, { backgroundColor: colors.cautionTint }]}>
        <Ionicons name="information-circle-outline" size={14} color={colors.caution} />
        <AppText variant="secondary" color={colors.caution} style={styles.bold}>
          {t('result.notDiagnosis')}
        </AppText>
      </View>
      <View style={[styles.chip, { backgroundColor: colors.tealTint }]}>
        <Ionicons name="analytics-outline" size={14} color={colors.tealDark} />
        <AppText variant="secondary" color={colors.tealDark} style={styles.bold}>
          {t('result.estimate')}
        </AppText>
      </View>
    </View>
  );
}

/**
 * The live strip under the model: neutral, one compact block, muscles only. It never shows a category or a conclusion.
 *  - the candidates are "Possible so far" (provisional) and are highlighted on the model from the first screen;
 *  - before two answers that are not unknown: "Still narrowing - keep going", no bands;
 *  - from then on each candidate carries a band (Low / Moderate / Higher), with "match strength, not a probability".
 */
export function CandidateStrip({ state }: { state: LiveState | null }) {
  const t = useT();
  const list = state?.candidates ?? [];
  const bands = state?.bandsVisible === true;
  const early = state?.outcome === 'muscle' && state.status === 'enough';
  const headline = early ? t('live.enough') : !state || !bands ? t('live.stillNarrowing') : t('live.possibleSoFar');
  const names = list.map((c) => (bands ? `${muscleName(c.muscleId)} (${t(`live.band.${c.band}` as const)})` : muscleName(c.muscleId))).join(' · ');
  return (
    <View style={styles.strip} accessibilityLiveRegion="polite">
      <View style={styles.head}>
        <AppText variant="secondary" color={early ? colors.safe : colors.navy} style={[styles.bold, styles.headline]}>
          {headline}
        </AppText>
        <NarrowingChips />
      </View>
      {list.length > 0 ? (
        <AppText variant="secondary" color={colors.navy} numberOfLines={1} style={styles.names}>
          {state?.provisional && !bands ? `${t('live.possibleSoFar')}: ` : ''}
          {names}
        </AppText>
      ) : null}
      {bands && list.length > 0 ? (
        <AppText variant="secondary" color={colors.muted} style={styles.italic} numberOfLines={1}>
          {state?.cluster ? `${t('live.clusterNote')} ` : ''}
          {t('live.matchCaption')}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: 2, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headline: { flex: 1 },
  names: { fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 26, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 13 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  row: { gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1 },
  band: { paddingHorizontal: 10, minHeight: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bandLow: { backgroundColor: colors.neutralTint },
  bandModerate: { backgroundColor: colors.cautionTint },
  bandHigher: { backgroundColor: colors.tealTint },
});
