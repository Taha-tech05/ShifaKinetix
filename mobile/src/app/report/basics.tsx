import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { StepProgress } from '../../components/StepProgress';
import type { TKey } from '../../i18n';
import { answered, unknown } from '../../questions/answer';
import type { Question, QuestionType } from '../../questions/types';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import { colors, radius, shadows } from '../../theme';

// Symptom basics (design P27). Content is draft, awaiting clinician review. "Not sure" is stored as unknown.
const q = (id: string, type: QuestionType, text: string): Question => ({ questionId: id, type, text, source: 'PLACEHOLDER, Person C replaces', label: 'draft, awaiting clinician review' });
const Q_WHEN = q('Q_BASICS_WHEN', 'chooseone', 'When did it start?');
const Q_HOW = q('Q_BASICS_HOW', 'chooseone', 'How did it start?');
const Q_NOW = q('Q_BASICS_PAIN_NOW', 'scale0to10', 'Pain right now (0 = none, 10 = worst)');
const Q_ALWAYS = q('Q_BASICS_ALWAYS', 'chooseone', 'Is the pain always there?');
const IDS = [Q_WHEN, Q_HOW, Q_NOW, Q_ALWAYS].map((x) => x.questionId);

const WHEN: { id: string; label: TKey }[] = [
  { id: 'today', label: 'basics.today' },
  { id: 'this_week', label: 'basics.thisWeek' },
  { id: 'longer', label: 'basics.longer' },
];
const HOW: { id: string; label: TKey }[] = [
  { id: 'after_injury', label: 'basics.afterInjury' },
  { id: 'slowly', label: 'basics.slowly' },
  { id: 'suddenly', label: 'basics.suddenly' },
];
const ALWAYS: { id: string; label: TKey }[] = [
  { id: 'constant', label: 'basics.constant' },
  { id: 'comes_goes', label: 'basics.comesGoes' },
];

function ChoiceRow({ question, title, options }: { question: Question; title: string; options: { id: string; label: string }[] }) {
  const t = useT();
  const answers = useSession((s) => s.answers);
  const recordAnswer = useSession((s) => s.recordAnswer);
  const current = answers.find((a) => a.questionId === question.questionId);
  const all = [...options, { id: '__unsure', label: t('answer.notSure') }];
  return (
    <View style={styles.group}>
      <AppText variant="bodyStrong" color={colors.navy}>
        {title}
      </AppText>
      <View style={styles.row}>
        {all.map((o) => {
          const unsure = o.id === '__unsure';
          const on = unsure ? current?.state === 'unknown' : current?.state === 'answered' && current.value === o.id;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: on }}
              onPress={() => recordAnswer(unsure ? unknown(question) : answered(question, o.id))}
              style={[styles.chip, on && styles.chipOn]}
            >
              <AppText variant="secondary" color={on ? colors.white : colors.navy} style={styles.chipText} numberOfLines={2}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PainNow({ title }: { title: string }) {
  const t = useT();
  const answers = useSession((s) => s.answers);
  const recordAnswer = useSession((s) => s.recordAnswer);
  const current = answers.find((a) => a.questionId === Q_NOW.questionId);
  const steps = Array.from({ length: 11 }, (_, i) => i);
  return (
    <View style={styles.group}>
      <AppText variant="bodyStrong" color={colors.navy}>
        {title}
      </AppText>
      <View style={styles.row}>
        {steps.map((n) => {
          const on = current?.state === 'answered' && current.value === n;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={String(n)}
              accessibilityState={{ selected: on }}
              onPress={() => recordAnswer(answered(Q_NOW, n))}
              style={[styles.num, on && styles.chipOn]}
            >
              <AppText variant="bodyStrong" color={on ? colors.white : colors.navy}>
                {n}
              </AppText>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('answer.notSure')}
          accessibilityState={{ selected: current?.state === 'unknown' }}
          onPress={() => recordAnswer(unknown(Q_NOW))}
          style={[styles.chip, current?.state === 'unknown' && styles.chipOn]}
        >
          <AppText variant="secondary" color={current?.state === 'unknown' ? colors.white : colors.navy} style={styles.chipText}>
            {t('answer.notSure')}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

/** P27: four short questions about the pain. Next is enabled when every one has an answer, "not sure" included. */
export default function Basics() {
  const t = useT();
  const answers = useSession((s) => s.answers);
  const done = IDS.every((id) => answers.some((a) => a.questionId === id));
  const tr = (list: { id: string; label: TKey }[]) => list.map((o) => ({ id: o.id, label: t(o.label) }));
  return (
    <Screen onBack={() => router.back()} footer={<Button label={t('common.next')} disabled={!done} onPress={() => router.push('/report/danger')} />}>
      <StepProgress step={2} total={5} />
      <AppText variant="h1" color={colors.navy}>
        {t('basics.title')}
      </AppText>
      <View style={styles.tag}>
        <AppText variant="secondary" color={colors.caution} style={styles.tagText}>
          {t('followUp.placeholderTag')}
        </AppText>
      </View>
      <ChoiceRow question={Q_WHEN} title={t('basics.when')} options={tr(WHEN)} />
      <ChoiceRow question={Q_HOW} title={t('basics.how')} options={tr(HOW)} />
      <PainNow title={t('basics.now')} />
      <ChoiceRow question={Q_ALWAYS} title={t('basics.always')} options={tr(ALWAYS)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 56,
    minWidth: 80,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontWeight: '700', textAlign: 'center' },
  num: { width: 48, height: 48, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  tag: { alignSelf: 'flex-start', backgroundColor: colors.cautionTint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontWeight: '700' },
});
