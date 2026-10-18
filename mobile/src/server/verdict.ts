import type { Verdict } from '../gate/evaluate';

const RANK: Record<Verdict, number> = { SAFE: 0, CLARIFY: 1, RED_FLAG: 2 };
const isVerdict = (v: unknown): v is Verdict => v === 'SAFE' || v === 'CLARIFY' || v === 'RED_FLAG';

/**
 * The more cautious of two verdicts. A missing or unrecognised verdict counts as CLARIFY ("not cleared"), never as SAFE, so
 * an error, a timeout or an empty answer can only make the result more careful.
 */
export function moreCautious(a: unknown, b: unknown): Verdict {
  const x = isVerdict(a) ? a : 'CLARIFY';
  const y = isVerdict(b) ? b : 'CLARIFY';
  return RANK[x] >= RANK[y] ? x : y;
}

export interface Shown {
  verdict: Verdict;
  /** True only when BOTH the phone and the server gave a verdict. Without it the screen must not show a cleared result. */
  confirmed: boolean;
}

/** What a screen shows when it has the phone verdict and (maybe) the server verdict. */
export function shownVerdict(phone: unknown, server: unknown): Shown {
  return { verdict: moreCautious(phone, server), confirmed: isVerdict(phone) && isVerdict(server) };
}

/** True only for a verdict that both sides gave and that is SAFE. The one place a screen may show cleared content. */
export const isCleared = (s: Shown): boolean => s.confirmed && s.verdict === 'SAFE';

/** What a verdict means for the reader. Cleared wording is only for a verdict both sides gave. */
export function verdictText(shown: Shown): string {
  if (shown.verdict === 'RED_FLAG') return 'Urgent: please see a doctor now.';
  if (shown.verdict === 'CLARIFY') return shown.confirmed ? 'Not cleared: more answers or a doctor are needed.' : 'Not cleared yet: this assessment has not been checked by both the phone and the server.';
  return shown.confirmed ? 'No safety stop found by the phone or the server.' : 'Not confirmed: the server has not checked this assessment.';
}
