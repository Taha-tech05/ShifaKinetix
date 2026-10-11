import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import type { LiveState } from '../../narrowing/live';
import { REGION_MAP } from '../../regions/regionMap';
import { useT } from '../../store/settings';
import { colors, radius } from '../../theme';
import { AppText } from '../AppText';
import { MatchBar } from './MatchBar';

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
 * The live strip under the model: what the answers point to so far.
 *  - fewer than two real answers: "Still narrowing - keep going", no list at all
 *  - candidates: muscle name, band (Low / Moderate / Higher) and a match bar, in no rank order, with no numbers
 *  - when the signal is enough (or the cap is reached): "Thanks, that's enough to go on"
 */
export function CandidateStrip({ state }: { state: LiveState | null }) {
  const t = useT();
  const stop = state?.stop === true;
  const list = state && state.status !== 'narrowing' ? state.candidates : [];
  const headline = stop ? t('live.enough') : !state || state.status === 'narrowing' ? t('live.stillNarrowing') : list.length === 0 ? t('live.noMatchYet') : t('live.candidatesSoFar');
  return (
    <View style={styles.strip} accessibilityLiveRegion="polite">
      <View style={styles.head}>
        <AppText variant="secondary" color={stop ? colors.safe : colors.navy} style={styles.bold} numberOfLines={2}>
          {headline}
        </AppText>
        <NarrowingChips />
      </View>
      {list.length > 0 ? (
        <>
          {list.map((c) => (
            <View key={c.muscleId} style={styles.row}>
              <View style={styles.rowTop}>
                <AppText variant="bodyStrong" color={colors.navy} style={styles.name} numberOfLines={2}>
                  {muscleName(c.muscleId)}
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
          <AppText variant="secondary" color={colors.muted}>
            {state?.cluster ? `${t('live.clusterNote')} ` : ''}
            {t('live.matchCaption')}
          </AppText>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: 6, padding: 10, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  head: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 26, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 13 },
  bold: { fontWeight: '700' },
  row: { gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1 },
  band: { paddingHorizontal: 10, minHeight: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bandLow: { backgroundColor: colors.neutralTint },
  bandModerate: { backgroundColor: colors.cautionTint },
  bandHigher: { backgroundColor: colors.tealTint },
});
