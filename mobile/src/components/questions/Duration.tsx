import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AnswerButton } from '../AnswerButton';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { Chip } from '../Chip';
import { answered } from '../../questions/answer';
import type { DurationUnit, DurationValue, TemplateProps } from '../../questions/types';
import { useT } from '../../store/settings';
import { colors, MIN_TAP, radius, spacing } from '../../theme';
import type { TKey } from '../../i18n';

const UNITS: { unit: DurationUnit; label: TKey }[] = [
  { unit: 'days', label: 'answer.unitDays' },
  { unit: 'weeks', label: 'answer.unitWeeks' },
  { unit: 'months', label: 'answer.unitMonths' },
];

export function Duration({ question, onAnswer }: TemplateProps) {
  const t = useT();
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState<DurationUnit>('days');
  const [notSure, setNotSure] = useState(false);

  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="h2" color={colors.navy}>
        {question.text}
      </AppText>
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="-"
          onPress={() => {
            setNotSure(false);
            setAmount((a) => Math.max(1, a - 1));
          }}
          style={styles.stepBtn}
        >
          <AppText variant="h2" color={colors.navy}>
            -
          </AppText>
        </Pressable>
        <AppText variant="display" color={colors.navy} accessibilityLabel={t('answer.durationValue')}>
          {amount}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="+"
          onPress={() => {
            setNotSure(false);
            setAmount((a) => Math.min(99, a + 1));
          }}
          style={styles.stepBtn}
        >
          <AppText variant="h2" color={colors.navy}>
            +
          </AppText>
        </Pressable>
      </View>
      <View style={styles.units}>
        {UNITS.map((u) => (
          <Chip
            key={u.unit}
            label={t(u.label)}
            selected={!notSure && unit === u.unit}
            onPress={() => {
              setNotSure(false);
              setUnit(u.unit);
            }}
          />
        ))}
      </View>
      <Button
        label={t('common.next')}
        disabled={notSure}
        onPress={() => onAnswer(answered(question, { amount, unit } satisfies DurationValue))}
      />
      <AnswerButton
        question={question}
        kind="notSure"
        selected={notSure}
        onAnswer={(result) => {
          setNotSure(true);
          onAnswer(result);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  stepBtn: {
    width: MIN_TAP + 8,
    height: MIN_TAP + 8,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
});
