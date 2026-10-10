import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AnswerButton } from '../AnswerButton';
import { AppText } from '../AppText';
import { answered } from '../../questions/answer';
import type { TemplateProps } from '../../questions/types';
import { useT } from '../../store/settings';
import { colors, MIN_TAP, radius, spacing } from '../../theme';

export function ChooseOne({ question, onAnswer }: TemplateProps) {
  const t = useT();
  const [picked, setPicked] = useState<string | null>(null);
  const [notSure, setNotSure] = useState(false);
  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="h1" color={colors.navy}>
        {question.text}
      </AppText>
      <AppText variant="secondary" color={colors.muted}>
        {t('answer.chooseOne')}
      </AppText>
      {(question.options ?? []).map((o) => {
        const selected = !notSure && picked === o.id;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => {
              setPicked(o.id);
              setNotSure(false);
              onAnswer(answered(question, o.id));
            }}
            style={[styles.option, selected && styles.selected]}
          >
            <AppText variant="button" color={selected ? colors.white : colors.navy}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
      <AnswerButton
        question={question}
        kind="notSure"
        layout="row"
        selected={notSure}
        onAnswer={(result) => {
          setNotSure(true);
          setPicked(null);
          onAnswer(result);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    minHeight: 56,
    minWidth: MIN_TAP,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.teal, borderColor: colors.teal },
});
