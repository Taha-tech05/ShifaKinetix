// Draft, awaiting clinician review. See docs/safety-integration.md.
import { Answer, evaluate, GateOutput, isValidAnswer, questions, SafetyAnswer } from './evaluate';

const ids = new Set(questions.map((q) => q.questionId));
const aliases: Record<string, string[]> = {
  Q_UNABLE_TO_MOVE_ARM: ['unable'],
  Q_ONSET_SUDDEN_TRAUMA: ['injury', 'sudden'],
  Q_BONE_TENDER_AFTER_TRAUMA: ['injury'],
  Q_NUMB_OR_WEAK: ['unable', 'numb', 'tingling'],
  Q_ST_NUMB: ['numb'],
  Q_ST_TINGLE: ['tingling'],
};
export const REVIEW_PREFIX = 'Q_SAFETY_REVIEW_';
export const MOVEMENT_CONTEXT = 'Q_SAFETY_MOVEMENT_CONTEXT';

function relevantSignals(input: Answer[], id: string): Answer[] {
  return input.filter((a) => {
    if (a.questionId === 'Q_BASICS_HOW') return (a.state === 'unknown' && ['injury', 'sudden'].includes(id))
      || (a.value === 'after_injury' && id === 'injury') || (a.value === 'suddenly' && id === 'sudden');
    if (!aliases[a.questionId]?.includes(id) || !(a.state === 'unknown' || a.value === true)) return false;
    // The combined onset signal adds no information when its original answer exists.
    return a.questionId !== 'Q_ONSET_SUDDEN_TRAUMA' || !input.some((x) => x.questionId === 'Q_BASICS_HOW');
  });
}

/** A follow-up is tied to the exact evidence and answer it reviewed. Changed
 * movement context requires another review. Metadata is not server authorization. */
export function safetyReviewToken(input: Answer[], id: string): string | null {
  const signals = relevantSignals(input, id);
  if (!signals.length) return null;
  const canonical = input.find((a) => a.questionId === id);
  const movement = ['unable', 'numb', 'tingling'].includes(id)
    ? input.find((a) => a.questionId === MOVEMENT_CONTEXT)?.value : undefined;
  const fields = (a: Answer) => [a.questionId, a.type, a.state, a.value];
  return JSON.stringify({ policy: 2, signals: signals.map(fields).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    movement, answer: canonical ? fields(canonical) : null });
}

export function pendingSafetyFollowups(input: Answer[]): string[] {
  return questions.filter((q) => {
    const token = safetyReviewToken(input, q.questionId);
    return token !== null && !input.some((a) => a.questionId === REVIEW_PREFIX + q.questionId
      && a.type === 'safety-review' && a.state === 'answered' && a.value === token);
  }).map((q) => q.questionId);
}

/** Broad app answers request the precise clinical question, not an automatic red
 * flag. A stored negative predating the new signal cannot clear it. */
export function safetyAnswersFrom(input: Answer[]): SafetyAnswer[] | null {
  const canonical = input.filter((a) => ids.has(a.questionId));
  if (!canonical.every(isValidAnswer) || new Set(canonical.map((a) => a.questionId)).size !== canonical.length) return null;
  for (const a of input) {
    if (aliases[a.questionId] && (a.type !== 'yesno' || !((a.state === 'unknown' && a.value === null)
      || (a.state === 'answered' && typeof a.value === 'boolean')))) return null;
    if (a.questionId === 'Q_BASICS_HOW' && !((a.state === 'unknown' && a.value === null)
      || (a.state === 'answered' && ['after_injury', 'suddenly', 'slowly'].includes(String(a.value))))) return null;
    if ((a.questionId.startsWith('Q_DANGER_') || (a as Answer & { flagged?: boolean }).flagged)
      && !ids.has(a.questionId) && !aliases[a.questionId]) return null;
  }
  const merged = new Map(canonical.map((a) => [a.questionId, a]));
  for (const id of pendingSafetyFollowups(input)) {
    // Confirmed danger always wins. Otherwise ask again about the new evidence.
    if (merged.get(id)?.value !== true) merged.set(id, {
      questionId: id, type: 'yesno', state: 'unknown', value: null, clarificationAttempted: false,
    });
  }
  return [...merged.values()];
}

export function evaluateSessionGate(input: Answer[]): GateOutput {
  return evaluate(safetyAnswersFrom(input));
}
