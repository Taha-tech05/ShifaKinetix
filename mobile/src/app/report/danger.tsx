import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { YesNoNotSure } from '../../components/questions/YesNoNotSure';
import { Screen } from '../../components/Screen';
import { StepProgress } from '../../components/StepProgress';
import { dangerQuestions } from '../../flow/dangerQuestions';
import { routeAfterGate } from '../../flow/intake';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { colors } from '../../theme';

/**
 * Red-flag questions, one per screen, then the gate stub. The questions are the PLACEHOLDER ones in
 * shared/questions_shoulder.json. RED_FLAG goes to the urgent screen and the flow stops; CLARIFY goes to the re-ask.
 */
export default function Danger() {
  const t = useT();
  const questions = useMemo(() => dangerQuestions(), []);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const recordAnswer = useSession((s) => s.recordAnswer);
  const runGate = useSession((s) => s.runGate);
  const reaskDone = useSession((s) => s.reaskDone);
  const question = questions[index];
  const last = index === questions.length - 1;

  return (
    <Screen
      onBack={() => (index > 0 ? (setIndex(index - 1), setAnswered(true)) : router.back())}
      footer={
        <Button
          label={t('common.next')}
          disabled={!answered}
          onPress={() => {
            if (!last) {
              setIndex(index + 1);
              setAnswered(false);
              return;
            }
            const verdict = runGate();
            router.replace(routeAfterGate(verdict, reaskDone) as never);
          }}
        />
      }
    >
      <StepProgress step={index + 1} total={questions.length} label={t('flow.question', { n: index + 1, total: questions.length })} />
      <AppText variant="secondary" color={colors.muted}>
        {t('danger.intro')}
      </AppText>
      <View style={styles.tag}>
        <AppText variant="secondary" color={colors.caution} style={styles.tagText}>
          {t('followUp.placeholderTag')}
        </AppText>
      </View>
      <YesNoNotSure
        key={question.questionId}
        question={question}
        onAnswer={(r) => {
          recordAnswer(r);
          setAnswered(true);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tag: { alignSelf: 'flex-start', backgroundColor: colors.cautionTint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontWeight: '700' },
});
