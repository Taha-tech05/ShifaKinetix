// Draft, awaiting clinician review. See docs/safety-integration.md (contract v2).
//
// Each thing is asked once. An app answer never re-opens a safety question by itself; it only asks again when it
// contradicts an answer the patient gave:
//   - the basics answer (how it started, the pain score) now differs from the canonical answer it filled in;
//   - the patient said they can move the arm, and after the whole movement set could not do at least one movement.
// A weak, painful, skipped or unknown movement is never a safety signal: it goes to narrowing.
import { Answer, evaluate, GateOutput, isValidAnswer, Question, questions, SafetyAnswer } from './evaluate';

const ids = new Set(questions.map((q) => q.questionId));
export const REVIEW_PREFIX = 'Q_SAFETY_REVIEW_';
export const MOVEMENT_CONTEXT = 'Q_SAFETY_MOVEMENT_CONTEXT';
/** The app's six guided movements: a contradiction is checked once, after the whole set. */
export const MOVEMENT_SET_SIZE = 6;
const FOLLOWUP_SOURCE = 'docs/safety-integration.md';
const FOLLOWUP_REASON = 'A later answer differs from this earlier answer; please confirm it.';
const BASICS_VALUES = ['after_injury', 'suddenly', 'slowly'];

type Movement = { movementId: string; state: string; unableToDo: boolean };

/** The value an earlier app answer gives for this canonical question (prefillFrom), or undefined. */
export function prefillValue(input: readonly Answer[], q: Question): SafetyAnswer['value'] | undefined {
  const source = q.prefillFrom;
  if (!source) return undefined;
  const given = input.find((a) => a.questionId === source.questionId);
  if (!given || given.state !== 'answered') return undefined;
  let value: unknown = given.value;
  if (source.map) {
    if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(source.map, value)) return undefined;
    value = source.map[value];
  }
  return isValidAnswer({ questionId: q.questionId, type: q.type, value, state: 'answered' })
    ? value as SafetyAnswer['value'] : undefined;
}

function movementsFrom(input: readonly Answer[]): Movement[] {
  const context = input.find((a) => a.questionId === MOVEMENT_CONTEXT);
  if (!context || typeof context.value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(context.value);
    return Array.isArray(parsed) ? parsed.filter((m): m is Movement => !!m && typeof m === 'object'
      && typeof (m as Movement).movementId === 'string') : [];
  } catch { return []; }
}

/** Movements the patient could not do, once the whole movement set has an answer; otherwise none. */
export function unableMovements(movements: readonly Movement[]): string[] {
  if (new Set(movements.map((m) => m.movementId)).size < MOVEMENT_SET_SIZE) return [];
  return [...new Set(movements.filter((m) => m.state !== 'unknown' && m.unableToDo === true).map((m) => m.movementId))].sort();
}

/** Each given canonical answer that a later app answer contradicts, with that evidence, in question order. */
export function safetyConflicts(input: readonly Answer[]): { questionId: string; evidence: unknown }[] {
  const out: { questionId: string; evidence: unknown }[] = [];
  for (const q of questions) {
    const own = input.find((a) => a.questionId === q.questionId);
    if (!own || own.state !== 'answered') continue;
    const pre = prefillValue(input, q);
    if (pre !== undefined && pre !== own.value) {
      out.push({ questionId: q.questionId, evidence: { from: q.prefillFrom!.questionId, value: pre } });
    } else if (q.questionId === 'unable' && own.value === false) {
      const failed = unableMovements(movementsFrom(input));
      if (failed.length) out.push({ questionId: q.questionId, evidence: { movements: failed } });
    }
  }
  return out;
}

/** A follow-up is tied to the exact evidence and answer it reviewed. Metadata is not server authorization. */
export function safetyReviewToken(input: Answer[], id: string): string | null {
  const conflict = safetyConflicts(input).find((c) => c.questionId === id);
  if (!conflict) return null;
  const own = input.find((a) => a.questionId === id)!;
  return JSON.stringify({ policy: 3, evidence: conflict.evidence, answer: [own.questionId, own.type, own.state, own.value] });
}

export function pendingSafetyFollowups(input: Answer[]): string[] {
  return safetyConflicts(input).map((c) => c.questionId).filter((id) => {
    const token = safetyReviewToken(input, id);
    return !input.some((a) => a.questionId === REVIEW_PREFIX + id && a.type === 'safety-review'
      && a.state === 'answered' && a.value === token);
  });
}

/** The canonical safety answers among all app answers. Null means the input cannot be trusted. */
export function safetyAnswersFrom(input: Answer[]): SafetyAnswer[] | null {
  const canonical = input.filter((a) => ids.has(a.questionId));
  if (!canonical.every(isValidAnswer) || new Set(canonical.map((a) => a.questionId)).size !== canonical.length) return null;
  for (const a of input) {
    if (a.questionId === 'Q_BASICS_HOW' && !((a.state === 'unknown' && a.value === null)
      || (a.state === 'answered' && typeof a.value === 'string' && BASICS_VALUES.includes(a.value)))) return null;
    // An unmapped safety input must not silently disappear as the app evolves.
    if (!ids.has(a.questionId) && (a.questionId.startsWith('Q_DANGER_') || (a as Answer & { flagged?: boolean }).flagged)) return null;
  }
  return canonical;
}

export function evaluateSessionGate(input: Answer[]): GateOutput {
  const canonical = safetyAnswersFrom(input);
  const output = evaluate(canonical);
  if (!canonical) return output;
  const pending = pendingSafetyFollowups(input);
  if (!pending.length) return output;
  const firedRules = [...output.firedRules, ...pending.map((id) => ({
    ruleId: `F_${id}`, matchedAnswers: [id], source: FOLLOWUP_SOURCE, reason: FOLLOWUP_REASON,
  }))];
  return output.verdict === 'SAFE' ? { verdict: 'CLARIFY', level: null, score: output.score, firedRules } : { ...output, firedRules };
}
