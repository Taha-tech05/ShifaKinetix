import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AnswerButton } from '../AnswerButton';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { answered } from '../../questions/answer';
import type { TemplateProps } from '../../questions/types';
import { useT } from '../../store/settings';
import { colors, MIN_TAP, radius, spacing } from '../../theme';

export function ChooseSeveral({ question, onAnswer }: TemplateProps) {
  const t = useT();
  const [picked, setPicked] = useState<string[]>([]);
  const [notSure, setNotSure] = useState(false);

  const toggle = (id: string) => {
    setNotSure(false);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="h1" color={colors.navy}>
        {question.text}
      </AppText>
      <AppText variant="secondary" color={colors.muted}>
        {t('answer.chooseSeveral')}
      </AppText>
      {(question.options ?? []).map((o) => {
        const selected = !notSure && picked.includes(o.id);
        return (
          <Pressable
            key={o.id}
            accessibilityRole="checkbox"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: selected }}
            onPress={() => toggle(o.id)}
            style={[styles.option, selected && styles.selected]}
          >
            <AppText variant="button" color={selected ? colors.white : colors.navy}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
      <Button
        label={t('common.next')}
        disabled={notSure || picked.length === 0}
        onPress={() => onAnswer(answered(question, picked))}
      />
      <AnswerButton
        question={question}
        kind="notSure"
        layout="row"
        selected={notSure}
        onAnswer={(result) => {
          setNotSure(true);
          setPicked([]);
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
