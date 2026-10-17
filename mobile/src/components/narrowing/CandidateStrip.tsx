import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import type { LiveCategory, LiveState } from '../../narrowing/live';
import { REGION_MAP } from '../../regions/regionMap';
import { useT } from '../../store/settings';
import { radius } from '../../theme';
import { AppText } from '../AppText';
import { MatchBar } from './MatchBar';
import { useMemo } from 'react';
import { useTheme } from '../../ui/ThemeProvider';
import type { Palette } from '../../ui/theme';

/** The name of a structure category in the current language. */
export function useCategoryName() {
  const t = useT();
  return (c: LiveCategory['category'] | 'UNCLEAR') => t(`live.category.${c}` as const);
}

/** The categories with a band and a match bar (no numbers, no ranks). */
export function CategoryRows({ categories }: { categories: LiveCategory[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const name = useCategoryName();
  return (
    <>
      {categories.map((c) => (
        <View key={c.category} style={styles.row}>
          <View style={styles.rowTop}>
            <AppText variant="bodyStrong" color={colors.text} style={styles.name} numberOfLines={2}>
              {name(c.category)}
            </AppText>
            <View style={[styles.band, c.band === 'higher' ? styles.bandHigher : c.band === 'moderate' ? styles.bandModerate : styles.bandLow]}>
              <AppText variant="secondary" color={colors.text} style={styles.bold}>
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  return (
    <View style={styles.chips}>
      <View style={[styles.chip, { backgroundColor: colors.cautionTint }]}>
        <Ionicons name="information-circle-outline" size={14} color={colors.caution} />
        <AppText variant="secondary" color={colors.caution} style={styles.bold}>
          {t('result.notDiagnosis')}
        </AppText>
      </View>
      <View style={[styles.chip, { backgroundColor: colors.accentTint }]}>
        <Ionicons name="analytics-outline" size={14} color={colors.accentText} />
        <AppText variant="secondary" color={colors.accentText} style={styles.bold}>
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
export function CandidateStrip({ state, maxShown = 3 }: { state: LiveState | null; maxShown?: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const list = (state?.candidates ?? []).slice(0, maxShown);
  const bands = state?.bandsVisible === true;
  const early = state?.outcome === 'muscle' && state.status === 'enough';
  const headline = early ? t('live.enough') : !state || !bands ? t('live.stillNarrowing') : t('live.possibleSoFar');
  return (
    <View style={styles.strip} accessibilityLiveRegion="polite">
      <View style={styles.head}>
        <AppText variant="secondary" color={early ? colors.safe : colors.text} style={[styles.bold, styles.headline]}>
          {headline}
        </AppText>
        <NarrowingChips />
      </View>
      {list.length > 0 ? (
        <AppText variant="secondary" color={colors.text} style={styles.bold}>
          {bands ? `${t('live.possibleSoFar')} - ${t('live.matchCaption')}` : t('live.possibleSoFar')}
        </AppText>
      ) : null}
      {list.map((c) => (
        <View key={c.muscleId} style={styles.nameRow}>
          <AppText variant="secondary" color={colors.text} style={[styles.name, styles.bold]}>
            {muscleName(c.muscleId)}
          </AppText>
          {bands ? (
            <View style={[styles.band, c.band === 'higher' ? styles.bandHigher : c.band === 'moderate' ? styles.bandModerate : styles.bandLow]}>
              <AppText variant="secondary" color={colors.text} style={styles.bold}>
                {t(`live.band.${c.band}` as const)}
              </AppText>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  strip: { gap: 2, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headline: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 26, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 13 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  row: { gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1 },
  band: { paddingHorizontal: 10, minHeight: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong },
  bandLow: { backgroundColor: colors.track },
  bandModerate: { backgroundColor: colors.cautionTint },
  bandHigher: { backgroundColor: colors.accentTint },
});
