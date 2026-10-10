import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../i18n';
import type { TKey } from '../i18n';
import { answered, unknown } from '../questions/answer';
import type { Question, QuestionResult } from '../questions/types';
import { colors, MIN_TAP, radius, shadows } from '../theme';
import { AppText } from './AppText';

export type AnswerKind = 'yes' | 'no' | 'notSure' | 'can' | 'cant';

const LABELS: Record<AnswerKind, TKey> = {
  yes: 'answer.yes',
  no: 'answer.no',
  notSure: 'answer.notSure',
  can: 'answer.can',
  cant: 'answer.cant',
};

const ICONS: Record<AnswerKind, keyof typeof Ionicons.glyphMap> = {
  yes: 'checkmark',
  no: 'close',
  notSure: 'help-circle-outline',
  can: 'checkmark',
  cant: 'close',
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
  /** 'tile': icon above label, for a row of three (design 88 high). 'row': icon beside label, full width (64 high). */
  layout?: 'tile' | 'row';
}

/** Yes, No and Not sure share one style, so none looks more important than another. */
export function AnswerButton({ question, kind, onAnswer, selected = false, layout = 'tile' }: Props) {
  const label = t(LABELS[kind]);
  const fg = selected ? colors.white : colors.navy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => onAnswer(resultFor(question, kind))}
      style={[styles.button, layout === 'tile' ? styles.tile : styles.row, selected && styles.selected]}
    >
      <Ionicons name={ICONS[kind]} size={24} color={fg} />
      <AppText variant="button" color={fg} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: MIN_TAP,
    borderRadius: radius.button,
    borderWidth: 2,
    borderColor: colors.fieldBorder,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  tile: { flex: 1, height: 88, flexDirection: 'column', gap: 4, paddingHorizontal: 4 },
  row: { alignSelf: 'stretch', height: 64, flexDirection: 'row', gap: 6 },
  selected: { backgroundColor: colors.navy, borderColor: colors.navy },
});
