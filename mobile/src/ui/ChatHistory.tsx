import { useMemo } from 'react';
import { describeBasics } from '../app/report/basics';
import type { TKey } from '../i18n';
import type { Answer } from '../gate/evaluate';
import { questions as gateQuestions } from '../gate/evaluate';
import { MOVEMENTS, localized } from '../movement/movements';
import { discriminatorQuestions } from '../narrowing/bank';
import { structureQuestions } from '../narrowing/structureBank';
import { regionLabel } from '../regions/shoulder';
import { useSession } from '../store/session';
import { useT } from '../store/settings';
import { BotBubble, UserBubble } from './chat';

type T = (key: TKey, params?: Record<string, string | number>) => string;

const MOVEMENT_LABELS: Record<string, TKey> = { noPain: 'movement.noPain', pain: 'movement.pain', weak: 'movement.weak', couldNot: 'movement.couldNot', unsure: 'answer.notSure', skip: 'movement.skip' };

/** What the patient said, in words. Read-only: it only formats answers that are already saved. */
function answerText(a: Answer, t: T): string {
  if (a.state === 'unknown' || a.value === null) return t('answer.notSure');
  if (typeof a.value === 'boolean') return a.value ? t('answer.yes') : t('answer.no');
  const gate = gateQuestions.find((q) => q.questionId === a.questionId);
  if (gate?.options) return gate.options.find((o) => o.value === a.value)?.label ?? String(a.value);
  if (gate?.unit) return `${a.value} ${gate.unit}`;
  return String(a.value);
}

interface Pair {
  key: string;
  question: string;
  answer: string;
}

/**
 * The conversation so far, built only from answers that are already saved (read-only): the confirmed spot, the basics, the safety
 * answers, the follow-up questions and the movements. The question being asked now (and the ones its route draws itself) are left out.
 */
export function ChatHistory({ exclude, afterConfirm }: { exclude: string[]; afterConfirm: boolean }) {
  const t = useT();
  const selection = useSession((s) => s.selection);
  const answers = useSession((s) => s.answers);
  const history = useSession((s) => s.history);
  const pairs = useMemo<Pair[]>(() => {
    const out: Pair[] = [];
    const label = selection ? regionLabel(selection.regionId, selection.subRegionId) : null;
    if (afterConfirm && label) out.push({ key: 'spot', question: t('scene.youSelected', { label }), answer: t('confirm.yes') });
    const live = history.filter((h) => !h.supersededAt);
    const liveIds = new Set(live.map((h) => h.id));
    const narrowing = [...structureQuestions(), ...discriminatorQuestions()];
    for (const a of answers) {
      if (exclude.includes(a.questionId) || liveIds.has(a.questionId)) continue;
      const basics = describeBasics(a, t);
      if (basics) {
        out.push({ key: a.questionId, ...basics });
        continue;
      }
      const gate = gateQuestions.find((q) => q.questionId === a.questionId);
      if (gate) out.push({ key: a.questionId, question: gate.wording, answer: answerText(a, t) });
    }
    for (const h of live) {
      if (exclude.includes(h.id)) continue;
      if (h.kind === 'movement') {
        const m = MOVEMENTS.find((x) => x.id === h.id);
        const words = h.label.split('+').map((k) => (MOVEMENT_LABELS[k] ? t(MOVEMENT_LABELS[k]) : k));
        out.push({ key: `m-${h.seq}`, question: m ? localized(m.name) : h.id, answer: words.join(' + ') });
      } else if (h.answer) {
        const q = narrowing.find((x) => x.questionId === h.id);
        if (q) out.push({ key: `q-${h.seq}`, question: q.text, answer: answerText(h.answer, t) });
      }
    }
    return out;
  }, [selection, answers, history, exclude, afterConfirm, t]);
  return (
    <>
      {pairs.map((p) => (
        <PairView key={p.key} pair={p} />
      ))}
    </>
  );
}

function PairView({ pair }: { pair: Pair }) {
  return (
    <>
      <BotBubble>{pair.question}</BotBubble>
      <UserBubble text={pair.answer} />
    </>
  );
}
