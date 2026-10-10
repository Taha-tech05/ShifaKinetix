import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AnswerButton } from '../AnswerButton';
import { AppText } from '../AppText';
import { answered } from '../../questions/answer';
import type { TemplateProps } from '../../questions/types';
import { useT } from '../../store/settings';
import { colors, MIN_TAP, radius, spacing } from '../../theme';

const STEPS = Array.from({ length: 11 }, (_, i) => i);

export function Scale0to10({ question, onAnswer }: TemplateProps) {
  const t = useT();
  const [picked, setPicked] = useState<number | null>(null);
  const [notSure, setNotSure] = useState(false);
  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="h1" color={colors.navy}>
        {question.text}
      </AppText>
      <View style={styles.grid}>
        {STEPS.map((n) => {
          const selected = !notSure && picked === n;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={String(n)}
              accessibilityState={{ selected }}
              onPress={() => {
                setPicked(n);
                setNotSure(false);
                onAnswer(answered(question, n));
              }}
              style={[styles.step, selected && styles.selected]}
            >
              <AppText variant="button" color={selected ? colors.white : colors.navy}>
                {n}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.ends}>
        <AppText variant="secondary" color={colors.muted}>
          0 {t('answer.scaleLow')}
        </AppText>
        <AppText variant="secondary" color={colors.muted}>
          10 {t('answer.scaleHigh')}
        </AppText>
      </View>
      <AnswerButton
        question={question}
        kind="notSure"
        layout="row"
        selected={notSure}
        onAnswer={(result) => {
          // "Not sure" is not zero: state is unknown and the value stays null.
          setNotSure(true);
          setPicked(null);
          onAnswer(result);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  step: {
    width: MIN_TAP + 4,
    height: MIN_TAP + 4,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.teal, borderColor: colors.teal },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
});
