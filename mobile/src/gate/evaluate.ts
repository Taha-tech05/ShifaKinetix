// Draft, awaiting clinician review. See docs/gate-contract.md (v2, weighted triage with linked questions).
import gateRules from '../../../shared/gate_rules.json';
import questionBank from '../../../shared/questions_shoulder.json';

export type Verdict = 'RED_FLAG' | 'SAFE' | 'CLARIFY';
/** Care level. RED_FLAG is EMERGENCY or URGENT, SAFE is SOON or ROUTINE, CLARIFY has no level yet. */
export type Level = 'EMERGENCY' | 'URGENT' | 'SOON' | 'ROUTINE';
export type Tier = 'hardStop' | 'gateway' | 'weighted' | 'context';
export type AnswerType = 'yesno' | 'choice' | 'number' | 'duration';
export interface Answer {
  questionId: string;
  type: string;
  value: unknown;
  state: 'answered' | 'unknown';
  clarificationAttempted?: boolean;
}
/** Only this validated subset crosses the clinical evaluator/storage boundary. */
export interface SafetyAnswer extends Answer {
  questionId: string;
  type: AnswerType;
  value: boolean | string | number | null;
  state: 'answered' | 'unknown';
  clarificationAttempted?: boolean;
}
/** One condition on an earlier answer. A clause has exactly one of equals, in, atLeast (optionally with below). */
export interface Clause {
  questionId: string;
  equals?: boolean | string | number;
  in?: (string | number | boolean)[];
  atLeast?: number;
  below?: number;
  /** askWhen only: a "Not sure" to that question also opens this one. */
  orUnknown?: boolean;
}
export interface Question {
  questionId: string;
  type: string;
  tier: Tier;
  wording: string;
  required: boolean;
  askWhen?: Clause[];
  deniedValue?: boolean | string;
  prefillFrom?: { questionId: string; map?: Record<string, string> };
  source: string;
  label: string;
  clarification: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  unit?: string;
}
export interface Rule {
  ruleId: string;
  description: string;
  all: Clause[];
  level?: 'EMERGENCY' | 'URGENT';
  points?: number;
  source: string;
  label: string;
}
export interface FiredRule {
  ruleId: string;
  matchedAnswers: string[];
  source: string;
  reason: string;
  /** Hard stops only. */
  level?: 'EMERGENCY' | 'URGENT';
  /** Weighted signals only (half points for an uncertain weighted answer). */
  points?: number;
}
export interface GateOutput {
  verdict: Verdict;
  level: Level | null;
  score: number;
  firedRules: FiredRule[];
}
export const questions: Question[] = questionBank.questions as unknown as Question[];
export const rules: Rule[] = gateRules.rules as unknown as Rule[];
export const THRESHOLDS: { SOON: number; URGENT: number } = gateRules.levels;
export const CONTENT_VERSION = questionBank.contentVersion;
const POLICY = 'docs/gate-contract.md';
const record = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/** Does an answered value meet a clause? Strict equality, never type coercion. */
export function valueMatches(clause: Clause, value: unknown): boolean {
  if (clause.equals !== undefined) return value === clause.equals;
  if (clause.in !== undefined) return clause.in.some((v) => v === value);
  if (clause.atLeast !== undefined) return typeof value === 'number' && value >= clause.atLeast
    && (clause.below === undefined || value < clause.below);
  return false;
}

function clauseMatches(clause: Clause, answers: readonly Answer[], forAsking: boolean): boolean {
  const a = answers.find((x) => x.questionId === clause.questionId);
  if (!a) return false;
  if (a.state === 'unknown') return forAsking && clause.orUnknown === true;
  return a.state === 'answered' && valueMatches(clause, a.value);
}

/** Is this question part of the check for these answers? Always-required ones, plus linked ones whose askWhen matches. */
export function isAskedQuestion(q: Question, answers: readonly Answer[]): boolean {
  if (q.tier === 'context') return false;
  return q.required || (q.askWhen ?? []).some((clause) => clauseMatches(clause, answers, true));
}
/** Kept for callers of contract v1: a question is required exactly when it is asked. */
export const isRequiredQuestion = isAskedQuestion;

/** Points an uncertain weighted answer adds: half of the largest single-sign points for that question. */
export function halfPoints(questionId: string): number {
  const top = Math.max(0, ...rules.filter((r) => r.points !== undefined && r.all.length === 1
    && r.all[0].questionId === questionId).map((r) => r.points!));
  return top / 2;
}

export function isValidAnswer(input: unknown): input is SafetyAnswer {
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

const RANK: Record<Level, number> = { ROUTINE: 0, SOON: 1, URGENT: 2, EMERGENCY: 3 };

export function evaluate(input: unknown): GateOutput {
  if (!Array.isArray(input) || !input.every(isValidAnswer)
    || new Set(input.map((a) => a.questionId)).size !== input.length) {
    return { verdict: 'RED_FLAG', level: 'URGENT', score: 0, firedRules: [{ ruleId: 'INPUT_INVALID', matchedAnswers: [],
      source: POLICY, reason: 'Invalid or conflicting answers; clinical review required.' }] };
  }
  const answers = new Map<string, SafetyAnswer>(input.map((a) => [a.questionId, a]));
  const firedRules: FiredRule[] = [];
  let hardStop: Level | null = null;
  let score = 0;
  // 1. Hard stops and weighted signals, in rule order. Any saved answer counts, asked or not.
  for (const rule of rules) {
    if (!rule.all.every((clause) => clauseMatches(clause, input, false))) continue;
    const fired: FiredRule = { ruleId: rule.ruleId, matchedAnswers: rule.all.map((c) => c.questionId),
      source: rule.source, reason: rule.description };
    if (rule.level) {
      fired.level = rule.level;
      if (!hardStop || RANK[rule.level] > RANK[hardStop]) hardStop = rule.level;
    } else {
      fired.points = rule.points ?? 0;
      score += fired.points;
    }
    firedRules.push(fired);
  }
  // 2. An uncertain weighted answer counts half: uncertainty never scores lower than No.
  for (const q of questions) {
    const a = answers.get(q.questionId);
    if (q.tier !== 'weighted' || a?.state !== 'unknown') continue;
    const points = halfPoints(q.questionId);
    if (points <= 0) continue;
    score += points;
    firedRules.push({ ruleId: `W_${q.questionId}`, matchedAnswers: [q.questionId], source: POLICY,
      reason: 'Answer is uncertain; counted at half weight.', points });
  }
  // 3. Completeness of the linked questions that apply to these answers.
  let incomplete = false;
  for (const q of questions.filter((item) => isAskedQuestion(item, input))) {
    const a = answers.get(q.questionId);
    if (!a) {
      incomplete = true;
      firedRules.push({ ruleId: `M_${q.questionId}`, matchedAnswers: [q.questionId], source: POLICY,
        reason: 'Required safety answer is missing.' });
    } else if (a.state === 'unknown' && q.tier === 'hardStop') {
      incomplete = true;
      firedRules.push({ ruleId: `U_${q.questionId}`, matchedAnswers: [q.questionId], source: POLICY,
        reason: a.clarificationAttempted ? 'Uncertainty persists after clarification; clinical review required.'
          : 'Safety answer is uncertain; ask the fixed clarification.' });
    }
  }
  // 4. Danger first, then uncertainty, then the care level from the points.
  if (hardStop || score >= THRESHOLDS.URGENT) {
    const level: Level = hardStop && RANK[hardStop] >= RANK.URGENT ? hardStop : 'URGENT';
    return { verdict: 'RED_FLAG', level, score, firedRules };
  }
  if (incomplete) return { verdict: 'CLARIFY', level: null, score, firedRules };
  return { verdict: 'SAFE', level: score >= THRESHOLDS.SOON ? 'SOON' : 'ROUTINE', score, firedRules };
}

/**
 * The question's answer, or what it counts as when it was not asked: if every answer that would open it was given and none
 * opened it (a gateway No, or a gradual onset for "changed shape"), it counts as its deniedValue. Null when not known.
 */
export function impliedAnswer(answers: readonly Answer[], questionId: string): Answer | null {
  const own = answers.find((a) => a.questionId === questionId);
  if (own) return own;
  const q = questions.find((x) => x.questionId === questionId);
  if (!q || q.deniedValue === undefined || !q.askWhen?.length) return null;
  const closed = q.askWhen.every((clause) => {
    const trigger = impliedAnswer(answers, clause.questionId);
    return trigger?.state === 'answered' && !valueMatches(clause, trigger.value);
  });
  return closed ? { questionId, type: q.type, value: q.deniedValue, state: 'answered' } : null;
}
