import type { Verdict } from '../gate/evaluate';
import type { ApiClient } from '../storage/apiClient';

/**
 * The server has no endpoint that lists assessments (docs/server-api.md has none), so the doctor's "Latest cases" are the ones
 * this app can name: the three demo cases made by `python -m app.seed_cases`, and any assessment uploaded from this phone in
 * this run. Each one is judged by the server's own gate (GET /intakes/{id}/gate). Replace `candidateIds` with the server list
 * when GET /intakes exists.
 */
export const DEMO_CASES: { id: string; label: string }[] = [
  { id: 'demo-case-danger', label: 'Demo case: danger answer (fake)' },
  { id: 'demo-case-safe', label: 'Demo case: all clear (fake)' },
  { id: 'demo-case-unsure', label: 'Demo case: not sure (fake)' },
];

export interface CaseRow {
  id: string;
  label: string;
  /** The server's verdict, or null when the server could not give one (error, timeout, not found). Never treated as safe. */
  verdict: Verdict | null;
}

/** Urgent first, then not sure, then cases the server could not judge, and the cleared ones last. */
const ORDER = (v: Verdict | null) => (v === 'RED_FLAG' ? 0 : v === 'CLARIFY' ? 1 : v === null ? 2 : 3);

export const candidateIds = (recent: string[]): { id: string; label: string }[] => {
  const known = new Map(DEMO_CASES.map((c) => [c.id, c.label]));
  const ids = [...recent, ...DEMO_CASES.map((c) => c.id)];
  return [...new Set(ids)].map((id) => ({ id, label: known.get(id) ?? 'Uploaded from this phone' }));
};

export async function loadCases(api: ApiClient, recent: string[]): Promise<CaseRow[]> {
  const rows = await Promise.all(candidateIds(recent).map(async ({ id, label }): Promise<CaseRow> => {
    try {
      return { id, label, verdict: (await api.gate(id)).verdict };
    } catch {
      return { id, label, verdict: null };
    }
  }));
  // sort is stable, so cases with the same urgency keep their order (this phone's newest uploads first)
  return rows.sort((a, b) => ORDER(a.verdict) - ORDER(b.verdict));
}
