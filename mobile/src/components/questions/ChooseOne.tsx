import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AnswerButton } from '../AnswerButton';
import { AppText } from '../AppText';
import { answered } from '../../questions/answer';
import type { TemplateProps } from '../../questions/types';
import { useT } from '../../store/settings';
import { MIN_TAP, radius, spacing } from '../../theme';
import { useMemo } from 'react';
import { useTheme } from '../../ui/ThemeProvider';
import type { Palette } from '../../ui/theme';

export function ChooseOne({ question, onAnswer }: TemplateProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [picked, setPicked] = useState<string | null>(null);
  const [notSure, setNotSure] = useState(false);
  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="h1" color={colors.text}>
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
            <AppText variant="button" color={selected ? colors.onAccent : colors.text}>
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

const makeStyles = (colors: Palette) => StyleSheet.create({
  option: {
    minHeight: 56,
    minWidth: MIN_TAP,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
});
