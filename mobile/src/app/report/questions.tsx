import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { ChooseOne } from '../../components/questions/ChooseOne';
import { Screen } from '../../components/Screen';
import { StepProgress } from '../../components/StepProgress';
import { DEPTH_QUESTION_ID, depthQuestion } from '../../questions/followUp';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { colors } from '../../theme';

/**
 * PLACEHOLDER follow-up screen. Person C replaces the questions. It holds the one fixed depth question that
 * replaced the Surface / Middle / Deep picker. "Not sure" is stored as state "unknown", never as another answer.
 */
export default function Questions() {
  const t = useT();
  const recordAnswer = useSession((s) => s.recordAnswer);
  const answered = useSession((s) => s.answers.some((a) => a.questionId === DEPTH_QUESTION_ID));
  const question = useMemo(() => depthQuestion(), [t]);
  return (
    <Screen
      onBack={() => router.back()}
      footer={<Button label={t('common.next')} disabled={!answered} onPress={() => router.push('/report/movement')} />}
    >
      <StepProgress step={2} total={5} />
      <View style={styles.tag}>
        <AppText variant="secondary" color={colors.caution} style={styles.tagText}>
          {t('followUp.placeholderTag')}
        </AppText>
      </View>
      <ChooseOne question={question} onAnswer={recordAnswer} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tag: { alignSelf: 'flex-start', backgroundColor: colors.cautionTint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontWeight: '700' },
});
