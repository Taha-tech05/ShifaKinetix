// What the safety check does next, as a pure function so it can be tested (contract v2, docs/safety-integration.md).
// Draft, awaiting clinician review.
//
// Order: a confirmed danger stops at once. Then a follow-up for a real contradiction. Then persistent uncertainty stops at
// the unclear screen. Then the next linked question that applies to the answers so far, in bank order: if an earlier app
// answer already gives it (prefillFrom), it is saved from there instead of being asked again.
import { Answer, GateOutput, isAskedQuestion, Question, questions, SafetyAnswer } from './evaluate';
import { pendingSafetyFollowups, prefillValue, safetyAnswersFrom } from './sessionAdapter';

export type SafetyStep =
  | { kind: 'prefill'; answer: SafetyAnswer }
  | { kind: 'ask'; question: Question; reason: 'new' | 'clarify' | 'followup' }
  | { kind: 'route'; to: '/report/urgent' | '/report/unclear' | '/report/safe' };

export function nextSafetyStep(input: Answer[], output: GateOutput): SafetyStep {
  if (output.verdict === 'RED_FLAG') return { kind: 'route', to: '/report/urgent' };
  const canonical = safetyAnswersFrom(input) ?? [];
  const followUp = pendingSafetyFollowups(input)[0];
  if (followUp) return { kind: 'ask', question: questions.find((q) => q.questionId === followUp)!, reason: 'followup' };
  const asked = questions.filter((q) => isAskedQuestion(q, canonical));
  if (asked.some((q) => q.tier === 'hardStop' && canonical.some((a) => a.questionId === q.questionId
    && a.state === 'unknown' && a.clarificationAttempted))) return { kind: 'route', to: '/report/unclear' };
  for (const q of asked) {
    const a = canonical.find((x) => x.questionId === q.questionId);
    if (!a) {
      const value = prefillValue(input, q);
      if (value !== undefined) {
        return { kind: 'prefill', answer: { questionId: q.questionId, type: q.type as SafetyAnswer['type'], value, state: 'answered' } };
      }
      return { kind: 'ask', question: q, reason: 'new' };
    }
    if (a.state === 'unknown' && q.tier === 'hardStop') return { kind: 'ask', question: q, reason: 'clarify' };
  }
  return { kind: 'route', to: output.verdict === 'SAFE' ? '/report/safe' : '/report/unclear' };
}

/** Position of a question among the questions that apply so far (for the progress line), 1-based. */
export function safetyProgress(input: Answer[], question: Question): { n: number; total: number } {
  const asked = questions.filter((q) => isAskedQuestion(q, safetyAnswersFrom(input) ?? []));
  const i = asked.findIndex((q) => q.questionId === question.questionId);
  return { n: (i < 0 ? asked.length : i) + 1, total: Math.max(asked.length, i + 1) };
}

/**
 * The plain reasons behind a care level, for the patient: the hard stops first, then the weighted signs. An uncertain answer
 * is described with `uncertain`. Never a diagnosis.
 */
export function levelReasons(output: GateOutput | null, uncertain: string): string[] {
  if (!output) return [];
  const out: string[] = [];
  for (const r of output.firedRules) {
    if (r.level || (r.points !== undefined && !r.ruleId.startsWith('W_'))) out.push(r.reason.replace(/[:.].*$/, '').trim());
  }
  if (output.firedRules.some((r) => r.ruleId.startsWith('W_'))) out.push(uncertain);
  return [...new Set(out)];
}
