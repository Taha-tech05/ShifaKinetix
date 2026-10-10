// PLACEHOLDER gate evaluator. Rules are draft, awaiting clinician review.
import gateRules from '../../../shared/gate_rules.json';

export type Verdict = 'RED_FLAG' | 'SAFE' | 'CLARIFY';

export interface Answer {
  questionId: string;
  type: string;
  value: unknown;
  state: 'answered' | 'unknown';
}

export interface FiredRule {
  ruleId: string;
  matchedAnswers: string[];
  source: string;
}

export interface GateOutput {
  verdict: Verdict;
  firedRules: FiredRule[];
}

interface Rule {
  ruleId: string;
  questionId: string;
  when: { state: string; value?: unknown };
  verdict: string;
  source: string;
}

const PRIORITY: Verdict[] = ['RED_FLAG', 'CLARIFY', 'SAFE'];

export function evaluate(answers: Answer[]): GateOutput {
  const firedRules: FiredRule[] = [];
  const verdicts: Verdict[] = [];

  for (const rule of gateRules.rules as Rule[]) {
    const matched = answers.filter(
      (a) =>
        a.questionId === rule.questionId &&
        a.state === rule.when.state &&
        (rule.when.value === undefined || a.value === rule.when.value),
    );
    if (matched.length > 0) {
      firedRules.push({
        ruleId: rule.ruleId,
        matchedAnswers: matched.map((a) => a.questionId),
        source: rule.source,
      });
      verdicts.push(rule.verdict as Verdict);
    }
  }

  const verdict =
    PRIORITY.find((v) => verdicts.includes(v)) ?? (gateRules.defaultVerdict as Verdict);
  return { verdict, firedRules };
}
