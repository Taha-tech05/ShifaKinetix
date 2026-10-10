import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { YesNoNotSure } from '../../components/questions/YesNoNotSure';
import { Screen } from '../../components/Screen';
import { StepProgress } from '../../components/StepProgress';
import { unknownDangerQuestions } from '../../flow/dangerQuestions';
import { routeAfterGate } from '../../flow/intake';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { colors } from '../../theme';

/**
 * CLARIFY (design P31): the key danger questions answered "not sure" are asked once more. After that the gate runs
 * again. If it is still CLARIFY, the next screen suggests talking to a doctor and the flow stops.
 */
export default function Reask() {
  const t = useT();
  const verdict = useSession((s) => s.gateVerdict);
  const initialAnswers = useSession.getState().answers;
  // Fixed when the screen opens, so questions do not vanish from the list while they are being answered.
  const questions = useMemo(() => unknownDangerQuestions(initialAnswers), []);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const recordAnswer = useSession((s) => s.recordAnswer);
  const runGate = useSession((s) => s.runGate);
  const setReaskDone = useSession((s) => s.setReaskDone);

  if (verdict !== 'CLARIFY') return <Redirect href="/report/danger" />;
  const question = questions[index];
  if (!question) return <Redirect href="/report/unclear" />;
  const last = index === questions.length - 1;

  return (
    <Screen
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
            setReaskDone(true);
            const next = runGate();
            router.replace(routeAfterGate(next, true) as never);
          }}
        />
      }
    >
      <StepProgress step={index + 1} total={questions.length} label={t('flow.question', { n: index + 1, total: questions.length })} />
      <View style={styles.banner}>
        <Ionicons name="happy-outline" size={22} color={colors.teal} />
        <AppText variant="body" color={colors.navy} style={styles.bannerText}>
          {t('reask.banner')}
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
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.tealTint, borderRadius: 14, padding: 12 },
  bannerText: { flex: 1 },
});
