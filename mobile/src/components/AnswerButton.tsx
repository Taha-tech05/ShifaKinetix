import { Pressable, StyleSheet } from 'react-native';
import { t } from '../i18n';
import type { TKey } from '../i18n';
import { answered, unknown } from '../questions/answer';
import type { Question, QuestionResult } from '../questions/types';
import { colors, MIN_TAP, radius, spacing } from '../theme';
import { AppText } from './AppText';

export type AnswerKind = 'yes' | 'no' | 'notSure' | 'can' | 'cant';

const LABELS: Record<AnswerKind, TKey> = {
  yes: 'answer.yes',
  no: 'answer.no',
  notSure: 'answer.notSure',
  can: 'answer.can',
  cant: 'answer.cant',
};

/** Value reported for each kind. "Not sure" is handled separately and has no value. */
const VALUES: Record<Exclude<AnswerKind, 'notSure'>, boolean> = {
  yes: true,
  no: false,
  can: true,
  cant: false,
};

/** Build the result for a pressed kind. "Not sure" is always state "unknown". */
export function resultFor(question: Question, kind: AnswerKind): QuestionResult {
  return kind === 'notSure' ? unknown(question) : answered(question, VALUES[kind]);
}

interface Props {
  question: Question;
  kind: AnswerKind;
  onAnswer: (result: QuestionResult) => void;
  selected?: boolean;
}

/** Yes, No and Not sure share one style, so none looks more important than another. */
export function AnswerButton({ question, kind, onAnswer, selected = false }: Props) {
  const label = t(LABELS[kind]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => onAnswer(resultFor(question, kind))}
      style={[styles.button, selected && styles.selected]}
    >
      <AppText variant="button" color={selected ? colors.white : colors.navy}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    minWidth: MIN_TAP,
    alignSelf: 'stretch',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.teal, borderColor: colors.teal },
});
