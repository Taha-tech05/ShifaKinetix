import { useState } from 'react';
import { View } from 'react-native';
import { AnswerButton } from '../AnswerButton';
import type { AnswerKind } from '../AnswerButton';
import { AppText } from '../AppText';
import { colors, spacing } from '../../theme';
import type { TemplateProps } from '../../questions/types';

const KINDS: AnswerKind[] = ['yes', 'no', 'notSure'];

export function YesNoNotSure({ question, onAnswer }: TemplateProps) {
  const [picked, setPicked] = useState<AnswerKind | null>(null);
  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="h1" color={colors.navy}>
        {question.text}
      </AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {KINDS.map((kind) => (
        <AnswerButton
          key={kind}
          question={question}
          kind={kind}
          selected={picked === kind}
          onAnswer={(result) => {
            setPicked(kind);
            onAnswer(result);
          }}
        />
      ))}
      </View>
    </View>
  );
}
