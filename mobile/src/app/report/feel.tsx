import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { IconTile } from '../../components/IconTile';
import type { Tone } from '../../components/IconTile';
import { CautionStrip } from '../../components/CautionStrip';
import { Screen } from '../../components/Screen';
import { StepProgress } from '../../components/StepProgress';
import { MOVEMENT_COUNT, routeAfterMovement } from '../../flow/intake';
import { SafeGuard } from '../../flow/SafeGuard';
import { MOVEMENTS, localized } from '../../movement/movements';
import { buildMovementResult } from '../../movement/result';
import type { Feel } from '../../movement/result';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { colors, radius, shadows } from '../../theme';

type Key = 'noPain' | 'pain' | 'weak' | 'couldNot' | 'unsure';
const ROWS: { key: Key; icon: keyof typeof Ionicons.glyphMap; tone: Tone; label: 'movement.noPain' | 'movement.pain' | 'movement.weak' | 'movement.couldNot' | 'answer.notSure' }[] = [
  { key: 'noPain', icon: 'happy-outline', tone: 'safe', label: 'movement.noPain' },
  { key: 'pain', icon: 'sad-outline', tone: 'danger', label: 'movement.pain' },
  { key: 'weak', icon: 'trending-down-outline', tone: 'caution', label: 'movement.weak' },
  { key: 'couldNot', icon: 'close-outline', tone: 'navy', label: 'movement.couldNot' },
  { key: 'unsure', icon: 'help-circle-outline', tone: 'teal', label: 'answer.notSure' },
];

/**
 * "What did you feel?" (design P11). Pain, Weak and Could not do it can be combined; No pain cannot be combined with
 * Pain; Not sure stands alone and is stored as state "unknown", never as "no pain".
 */
export default function FeelScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ i?: string }>();
  const mode = useSession((s) => s.mode);
  const recordMovement = useSession((s) => s.recordMovement);
  const [picked, setPicked] = useState<Set<Key>>(new Set());
  const i = Math.max(0, Math.min(MOVEMENT_COUNT - 1, Number(params.i ?? 0) || 0));
  const movement = MOVEMENTS[i];

  const toggle = (k: Key) => {
    const next = new Set(picked);
    if (k === 'unsure') return setPicked(new Set(['unsure']));
    next.delete('unsure');
    if (next.has(k)) next.delete(k);
    else {
      next.add(k);
      if (k === 'noPain') next.delete('pain');
      if (k === 'pain') next.delete('noPain');
    }
    setPicked(next);
  };

  const submit = () => {
    const feel: Feel = picked.has('unsure')
      ? { kind: 'unsure' }
      : { kind: 'felt', pain: picked.has('pain'), weak: picked.has('weak'), couldNot: picked.has('couldNot') };
    recordMovement(buildMovementResult(movement.id, feel));
    router.replace(routeAfterMovement(i) as never);
  };

  return (
    <SafeGuard>
      {mode !== 'region' ? (
        <Redirect href="/report/followup" />
      ) : (
        <Screen
          onBack={() => router.back()}
          banner={<CautionStrip text={localized(movement.caution)} />}
          footer={<Button label={t('common.next')} disabled={picked.size === 0} onPress={submit} />}
        >
          <StepProgress step={i + 1} total={MOVEMENT_COUNT} label={t('movement.of', { n: i + 1, total: MOVEMENT_COUNT })} />
          <AppText variant="h1" color={colors.navy}>
            {t('movement.feelTitle')}
          </AppText>
          <AppText variant="body" color={colors.muted}>
            {t('movement.feelSub', { n: i + 1, name: localized(movement.name) })}
          </AppText>
          {ROWS.map((r) => {
            const on = picked.has(r.key);
            return (
              <Pressable
                key={r.key}
                accessibilityRole="checkbox"
                accessibilityLabel={t(r.label)}
                accessibilityState={{ checked: on }}
                onPress={() => toggle(r.key)}
                style={[styles.row, on && styles.rowOn]}
              >
                <IconTile icon={r.icon} tone={r.tone} />
                <AppText variant="bodyStrong" color={colors.navy} style={styles.label}>
                  {t(r.label)}
                </AppText>
                <View style={[styles.box, on && styles.boxOn]}>{on ? <Ionicons name="checkmark" size={18} color={colors.white} /> : null}</View>
              </Pressable>
            );
          })}
        </Screen>
      )}
    </SafeGuard>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    ...shadows.card,
  },
  rowOn: { borderColor: colors.teal, backgroundColor: '#F3FAFA' },
  label: { flex: 1 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#A9B6C2', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.teal, borderColor: colors.teal },
});
