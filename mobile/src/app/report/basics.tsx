import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import type { TKey } from '../../i18n';
import { answered, unknown } from '../../questions/answer';
import type { Question, QuestionType } from '../../questions/types';
import { useSession } from '../../store/session';
import { useT } from '../../store/settings';
import type { Answer } from '../../gate/evaluate';
import { BotBubble, ChipRow } from '../../ui/chat';
import { Chip } from '../../ui/Chip';
import { SceneSheetContent, useSceneStep } from '../../ui/SceneSheetContent';
import { useTheme } from '../../ui/ThemeProvider';

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

const TITLES: Record<string, TKey> = { Q_BASICS_WHEN: 'basics.when', Q_BASICS_HOW: 'basics.how', Q_BASICS_PAIN_NOW: 'basics.now', Q_BASICS_ALWAYS: 'basics.always' };
const OPTION_LISTS: Record<string, { id: string; label: TKey }[]> = { Q_BASICS_WHEN: WHEN, Q_BASICS_HOW: HOW, Q_BASICS_ALWAYS: ALWAYS };

/** How a saved basics answer reads in the chat history above (read-only). Null when the answer is not a basics answer. */
export function describeBasics(a: Answer, t: (key: TKey) => string): { question: string; answer: string } | null {
  const title = TITLES[a.questionId];
  if (!title) return null;
  if (a.state === 'unknown') return { question: t(title), answer: t('answer.notSure') };
  const opt = OPTION_LISTS[a.questionId]?.find((o) => o.id === a.value);
  return { question: t(title), answer: opt ? t(opt.label) : String(a.value) };
}

function ChoiceRow({ question, title, options }: { question: Question; title: string; options: { id: string; label: string }[] }) {
  const t = useT();
  const answers = useSession((s) => s.answers);
  const recordAnswer = useSession((s) => s.recordAnswer);
  const current = answers.find((a) => a.questionId === question.questionId);
  const all = [...options, { id: '__unsure', label: t('answer.notSure') }];
  return (
    <>
      <BotBubble>{title}</BotBubble>
      <ChipRow>
        {all.map((o) => {
          const unsure = o.id === '__unsure';
          const on = unsure ? current?.state === 'unknown' : current?.state === 'answered' && current.value === o.id;
          return <Chip key={o.id} large label={o.label} selected={on} onPress={() => recordAnswer(unsure ? unknown(question) : answered(question, o.id))} />;
        })}
      </ChipRow>
    </>
  );
}

function PainNow({ title }: { title: string }) {
  const t = useT();
  const answers = useSession((s) => s.answers);
  const recordAnswer = useSession((s) => s.recordAnswer);
  const current = answers.find((a) => a.questionId === Q_NOW.questionId);
  const steps = Array.from({ length: 11 }, (_, i) => i);
  return (
    <>
      <BotBubble>{title}</BotBubble>
      <ChipRow>
        {steps.map((n) => (
          <Chip key={n} large label={String(n)} selected={current?.state === 'answered' && current.value === n} onPress={() => recordAnswer(answered(Q_NOW, n))} style={{ minWidth: 56, paddingHorizontal: 0 }} />
        ))}
        <Chip large label={t('answer.notSure')} selected={current?.state === 'unknown'} onPress={() => recordAnswer(unknown(Q_NOW))} />
      </ChipRow>
    </>
  );
}

/** P27: four short questions about the pain, one chat bubble each. They appear one after another; every one can be changed. Next is enabled when every one has an answer, "not sure" included. */
export default function Basics() {
  const { colors } = useTheme();
  const t = useT();
  const answers = useSession((s) => s.answers);
  const done = IDS.every((id) => answers.some((a) => a.questionId === id));
  const firstOpen = IDS.findIndex((id) => !answers.some((a) => a.questionId === id));
  const shown = firstOpen === -1 ? IDS.length : firstOpen + 1;
  const tr = (list: { id: string; label: TKey }[]) => list.map((o) => ({ id: o.id, label: t(o.label) }));
  useSceneStep({ stepKey: 'basics', mode: 'questions', progress: { label: t('scene.phaseBasics', { n: shown, total: IDS.length }), value: shown / IDS.length } });
  return (
    <SceneSheetContent contentKey={`basics-${shown}`} ownIds={IDS} onBack={() => router.back()}>
      <AppText variant="secondary" color={colors.caution}>
        {t('followUp.placeholderTag')}
      </AppText>
      <ChoiceRow question={Q_WHEN} title={t('basics.when')} options={tr(WHEN)} />
      {shown >= 2 ? <ChoiceRow question={Q_HOW} title={t('basics.how')} options={tr(HOW)} /> : null}
      {shown >= 3 ? <PainNow title={t('basics.now')} /> : null}
      {shown >= 4 ? <ChoiceRow question={Q_ALWAYS} title={t('basics.always')} options={tr(ALWAYS)} /> : null}
      {done ? (
        <View>
          <Button label={t('common.next')} onPress={() => router.push('/report/danger')} />
        </View>
      ) : null}
    </SceneSheetContent>
  );
}
