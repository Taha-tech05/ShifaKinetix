import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ResultBody } from '../../components/body3d/ResultBody';
import { Screen } from '../../components/Screen';
import { StepProgress } from '../../components/StepProgress';
import { runNarrowing, suggestDoctor } from '../../flow/intake';
import { SafeGuard } from '../../flow/SafeGuard';
import { REGION_MAP, meshNamesOfStructures } from '../../regions/regionMap';
import { regionLabel } from '../../regions/shoulder';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { colors, radius, shadows } from '../../theme';

/**
 * Result (design P13): "Muscles that may be involved. Not a diagnosis. Estimate", highlighted on the body.
 * The numbers come from the dummy narrowing (dev/narrowingStub.ts, Person C replaces). Low confidence or a cluster
 * adds a suggestion to see a doctor. Reachable only after the verdict SAFE.
 */
export default function Result() {
  const t = useT();
  const state = useSession();
  const out = useMemo(() => runNarrowing(state), [state.gateVerdict, state.selection, state.answers, state.movementResults]);
  const sel = state.selection;
  const where = sel ? regionLabel(sel.regionId, sel.subRegionId) : null;
  const candidates = out?.candidates ?? [];
  const names = useMemo(() => meshNamesOfStructures(candidates.map((c) => c.muscleId)), [out]);
  const doctor = out ? suggestDoctor(out) : true;
  const behind = sel?.subRegionId === 'back' || sel?.subRegionId === 'scapular';

  return (
    <SafeGuard>
      <Screen
        onBack={() => router.back()}
        footer={
          <>
            <Button label={t('result.seeAdvice')} onPress={() => router.push('/report/choice')} />
            <Button variant="text" label={t('result.talkDoctor')} onPress={() => router.push('/report/doctor')} />
          </>
        }
      >
        <StepProgress step={5} total={5} />
        <AppText variant="h1" color={colors.navy}>
          {t('result.title')}
        </AppText>
        <View style={styles.chips}>
          <View style={[styles.chip, { backgroundColor: colors.cautionTint }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.caution} />
            <AppText variant="secondary" color={colors.caution} style={styles.bold}>
              {t('result.notDiagnosis')}
            </AppText>
          </View>
          <View style={[styles.chip, { backgroundColor: colors.tealTint }]}>
            <Ionicons name="analytics-outline" size={16} color={colors.tealDark} />
            <AppText variant="secondary" color={colors.tealDark} style={styles.bold}>
              {t('result.estimate')}
            </AppText>
          </View>
        </View>
        <ResultBody highlightNames={names} initialYaw={behind ? Math.PI : 0} />
        {doctor ? (
          <Card tone="mint" row>
            <Ionicons name="medkit-outline" size={24} color={colors.tealDark} />
            <AppText variant="body" color={colors.navy} style={styles.col}>
              {t('result.suggestDoctor')}
            </AppText>
          </Card>
        ) : null}
        {candidates.length === 0 ? (
          <AppText variant="body" color={colors.muted}>
            {t('result.none')}
          </AppText>
        ) : (
          candidates.map((c, i) => (
            <View key={c.muscleId} style={styles.item}>
              <View style={[styles.rank, { backgroundColor: i === 0 ? colors.teal : colors.tealSoft }]}>
                <AppText variant="bodyStrong" color={colors.white}>
                  {i + 1}
                </AppText>
              </View>
              <View style={styles.col}>
                <AppText variant="bodyStrong" color={colors.navy}>
                  {REGION_MAP.structures[c.muscleId]?.name ?? c.muscleId}
                </AppText>
                {where ? (
                  <AppText variant="secondary" color={colors.muted}>
                    {where}
                  </AppText>
                ) : null}
              </View>
            </View>
          ))
        )}
      </Screen>
    </SafeGuard>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 10, borderRadius: 16 },
  bold: { fontWeight: '700' },
  col: { flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.card, backgroundColor: colors.white, ...shadows.card },
  rank: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
