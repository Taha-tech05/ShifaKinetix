// Draft, awaiting clinician review. See docs/safety-integration.md.
// The UI contains non-clinical answers too; evaluate() remains strict and unchanged.
import { Answer, evaluate, GateOutput, isValidAnswer, questions, SafetyAnswer } from './evaluate';

const ids = new Set(questions.map((q) => q.questionId));
const aliases: Record<string, string[]> = {
  Q_UNABLE_TO_MOVE_ARM: ['unable'],
  Q_ONSET_SUDDEN_TRAUMA: ['injury', 'sudden'],
  Q_BONE_TENDER_AFTER_TRAUMA: ['injury'],
  Q_NUMB_OR_WEAK: ['numb'],
  Q_ST_NUMB: ['numb'],
  Q_ST_TINGLE: ['tingling'],
};

/** Preserve danger/uncertainty from the app without turning its ordinary answers into gate inputs. */
export function safetyAnswersFrom(input: Answer[]): SafetyAnswer[] | null {
  const canonical = input.filter((a) => ids.has(a.questionId));
  if (!canonical.every(isValidAnswer) || new Set(canonical.map((a) => a.questionId)).size !== canonical.length) return null;
  const merged = new Map(canonical.map((a) => [a.questionId, a]));
  function signal(id: string, a: Answer) {
    const old = merged.get(id);
    // Uncertainty requests the canonical clarification. Never fabricate a clinical answer
    // (e.g. movement weakness is not the same question as loss of sensation).
    if (a.state === 'unknown' && old?.value !== true) {
      merged.set(id, { questionId: id, type: 'yesno', state: 'unknown', value: null,
        clarificationAttempted: old?.clarificationAttempted });
    }
  }
  for (const a of input) {
    if (aliases[a.questionId]) {
      if (a.type !== 'yesno' || !((a.state === 'unknown' && a.value === null)
        || (a.state === 'answered' && typeof a.value === 'boolean'))) return null;
      for (const id of aliases[a.questionId]) signal(id, a);
    }
    if (a.questionId === 'Q_BASICS_HOW') {
      if (a.state === 'answered' && !['after_injury', 'suddenly', 'slowly'].includes(String(a.value))) return null;
      if (a.state === 'unknown') { signal('injury', a); signal('sudden', a); }
      if (a.value === 'after_injury') signal('injury', { ...a, value: true });
      if (a.value === 'suddenly') signal('sudden', { ...a, value: true });
    }
    // Unmapped safety inputs must not silently disappear as the UI evolves.
    if ((a.questionId.startsWith('Q_DANGER_') || (a as Answer & { flagged?: boolean }).flagged)
      && !ids.has(a.questionId) && !aliases[a.questionId]) return null;
  }
  return [...merged.values()];
}

export function evaluateSessionGate(input: Answer[]): GateOutput {
  const canonical = safetyAnswersFrom(input);
  const output = evaluate(canonical);
  const signals = input.filter((a) => (aliases[a.questionId] && a.state === 'answered' && a.value === true)
    || (a.questionId === 'Q_BASICS_HOW' && a.state === 'answered' && ['after_injury', 'suddenly'].includes(String(a.value))));
  if (!signals.length) return output;
  return { verdict: 'RED_FLAG', firedRules: [...output.firedRules, ...signals.map((a) => ({
    ruleId: `APP_REVIEW_${a.questionId}`, matchedAnswers: [a.questionId],
    source: 'https://www.nhs.uk/symptoms/shoulder-pain/',
    reason: 'draft, awaiting clinician review: a new app safety signal requires clinical review before continuing.',
  }))] };
}
