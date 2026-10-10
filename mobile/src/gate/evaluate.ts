// Draft, awaiting clinician review. See docs/gate-contract.md.
import gateRules from '../../../shared/gate_rules.json';
import questionBank from '../../../shared/questions_shoulder.json';

export type Verdict = 'RED_FLAG' | 'SAFE' | 'CLARIFY';
export type AnswerType = 'yesno' | 'choice' | 'number' | 'duration';
export interface Answer {
  questionId: string;
  type: AnswerType;
  value: boolean | string | number | null;
  state: 'answered' | 'unknown';
  clarificationAttempted?: boolean;
}
export interface Question {
  questionId: string;
  type: string;
  wording: string;
  required: boolean;
  source: string;
  label: string;
  clarification: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  unit?: string;
}
export interface FiredRule {
  ruleId: string;
  matchedAnswers: string[];
  source: string;
  reason: string;
}
export interface GateOutput { verdict: Verdict; firedRules: FiredRule[] }
export const questions: Question[] = questionBank.questions;
export const CONTENT_VERSION = questionBank.contentVersion;
const POLICY = 'docs/gate-contract.md';
const record = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

export function isValidAnswer(input: unknown): input is Answer {
  if (!record(input)) return false;
  const q = questions.find((item) => item.questionId === input.questionId);
  if (!q || input.type !== q.type) return false;
  if (input.clarificationAttempted !== undefined && typeof input.clarificationAttempted !== 'boolean') return false;
  if (input.state === 'unknown') return input.value === null;
  if (input.state !== 'answered') return false;
  switch (q.type) {
    case 'yesno': return typeof input.value === 'boolean';
    case 'choice': return q.options?.some((option) => option.value === input.value) === true;
    case 'number':
    case 'duration': return typeof input.value === 'number' && Number.isFinite(input.value)
      && input.value >= (q.min ?? 0) && input.value <= (q.max ?? Number.MAX_SAFE_INTEGER);
    default: return false;
  }
}

export function evaluate(input: unknown): GateOutput {
  if (!Array.isArray(input) || !input.every(isValidAnswer)
    || new Set(input.map((a) => a.questionId)).size !== input.length) {
    return { verdict: 'RED_FLAG', firedRules: [{ ruleId: 'INPUT_INVALID', matchedAnswers: [],
      source: POLICY, reason: 'Invalid or conflicting answers; clinical review required.' }] };
  }
  const answers = new Map<string, Answer>(input.map((a) => [a.questionId, a]));
  const firedRules: FiredRule[] = [];
  let danger = false;
  for (const rule of gateRules.rules) {
    if (rule.all.every((clause) => {
      const a = answers.get(clause.questionId);
      return a?.state === 'answered' && a.value === clause.equals;
    })) {
      danger = true;
      firedRules.push({ ruleId: rule.ruleId, matchedAnswers: rule.all.map((c) => c.questionId),
        source: rule.source, reason: rule.description });
    }
  }
  for (const q of questions.filter((item) => item.required)) {
    const a = answers.get(q.questionId);
    if (!a) {
      firedRules.push({ ruleId: `M_${q.questionId}`, matchedAnswers: [q.questionId], source: POLICY,
        reason: 'Required safety answer is missing.' });
    } else if (a.state === 'unknown') {
      danger ||= a.clarificationAttempted === true;
      firedRules.push({ ruleId: `U_${q.questionId}`, matchedAnswers: [q.questionId], source: POLICY,
        reason: a.clarificationAttempted ? 'Uncertainty persists after clarification; clinical review required.'
          : 'Safety answer is uncertain; ask the fixed clarification.' });
    }
  }
  return { verdict: danger ? 'RED_FLAG' : firedRules.length ? 'CLARIFY' : 'SAFE', firedRules };
}
