import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { ChooseOne } from '../../components/questions/ChooseOne';
import { YesNoNotSure } from '../../components/questions/YesNoNotSure';
import { Screen } from '../../components/Screen';
import { StepProgress } from '../../components/StepProgress';
import { followUpQuestions } from '../../dev/followUpQuestions';
import { RESULT_ROUTE } from '../../flow/intake';
import { SafeGuard } from '../../flow/SafeGuard';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { colors } from '../../theme';

/**
 * PLACEHOLDER follow-up questions (dev/followUpQuestionsStub.json, Person C replaces). Includes the fixed depth
 * question. "Not sure" is stored as state "unknown", never as another answer. Only after the verdict SAFE.
 */
export default function FollowUp() {
  const t = useT();
  const questions = useMemo(() => followUpQuestions(), [t]);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const recordAnswer = useSession((s) => s.recordAnswer);
  const question = questions[index];
  const last = index === questions.length - 1;

  return (
    <SafeGuard>
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
              router.replace(RESULT_ROUTE as never);
            }}
          />
        }
      >
        <StepProgress step={index + 1} total={questions.length} label={t('flow.question', { n: index + 1, total: questions.length })} />
        <View style={styles.tag}>
          <AppText variant="secondary" color={colors.caution} style={styles.tagText}>
            {t('followUp.placeholderTag')}
          </AppText>
        </View>
        {question.type === 'chooseone' ? (
          <ChooseOne
            key={question.questionId}
            question={question}
            onAnswer={(r) => {
              recordAnswer(r);
              setAnswered(true);
            }}
          />
        ) : (
          <YesNoNotSure
            key={question.questionId}
            question={question}
            onAnswer={(r) => {
              recordAnswer(r);
              setAnswered(true);
            }}
          />
        )}
      </Screen>
    </SafeGuard>
  );
}

const styles = StyleSheet.create({
  tag: { alignSelf: 'flex-start', backgroundColor: colors.cautionTint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontWeight: '700' },
});
