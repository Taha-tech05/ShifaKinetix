# Person C: independent review of the shoulder gate rules

Status: draft, awaiting clinician review. Demo only, not for real patients.

Reviewed by Person C (Saud). First review 2026-10-12 at `shoulder-1`;
re-reviewed 2026-10-13 at `shoulder-2` (gate contract v1.2, `feature/A-gate`
at `d002a65`). Files: `shared/gate_rules.json`, `shared/questions_shoulder.json`,
`shared/clinical_sources.json`, `shared/gate_test_cases.json`,
`docs/gate-contract.md` and `docs/safety-integration.md`.

This is an engineering review of structure, consistency and the "not sure never
means no" policy. It is not a clinical review and approves no clinical content.
Every label stays "draft, awaiting clinician review".

## Outcome at `shoulder-2`

The rules, the questions and the v1.2 contract are consistent and the Python
gate matches them. Two problems in `shared/gate_test_cases.json` fail the
server test suite and need fixing by A before merge (findings 1 and 2). I did
not change that file or the rules.

## What was checked

| Check | Result |
| --- | --- |
| Questions and rules carry the same content version | Yes, `shoulder-2` |
| Every rule clause and every `requiredWhen` clause names an existing question | Yes |
| Every `equals` value is valid for its question type | Yes |
| Every rule and question has a non-empty `source` listed in `clinical_sources.json` | Yes |
| Every rule and question carries the draft label; none says validated | Yes |
| Every rule is exercised by at least one fixture | Yes |
| Python gate gives the complete expected output on all 47 fixtures | Yes |
| Python and TypeScript complete outputs are identical on all 47 fixtures | Yes |
| Python and the mobile pipeline agree on the 51 raw app-signal fixtures | Yes |
| Every fixture has a `source` and the draft label | **No: 7 fixtures (finding 1)** |
| Danger cases come first in the fixture file | **No (finding 2)** |

## Findings at `shoulder-2`

### 1. Seven new fixtures have no `source` and no `label` (fix needed, A)

The seven `conditional_infection_*` cases added for v1.2 lack both fields.
`server/tests/test_rules_have_sources.py`, part of the original skeleton,
fails on each of them, so the `server` CI job will be red. Suggested values:
the `infection_risk` question's own source,
`https://www.ncbi.nlm.nih.gov/sites/books/NBK538176/`, and the draft label.

### 2. The fixture file is no longer danger-first (fix needed, A)

The contract says "danger cases first". Two things break that order:

- `persistent_unknown` is now CLARIFY but still sits among the RED_FLAG cases;
- the seven conditional cases are appended after the SAFE cases, and two of
  them (`conditional_infection_positive`, `conditional_infection_danger_priority`)
  are RED_FLAG.

`server/tests/test_gate.py::test_danger_cases_come_first` fails. Reordering the
file fixes it; no expected output needs to change.

### 3. Persistent uncertainty no longer refers the patient (for the clinician)

Under v1.1 a patient who answers "not sure" twice to, for example, chest
pressure gets CLARIFY and the unclear screen, not a referral. Movements stay
blocked and the verdict is never SAFE, so nothing unsafe is unlocked. It does
change the original team rule ("if it stays unclear, send the patient to a
doctor") into "stop and offer review or a doctor". The server follows the
contract. The wording of the unclear screen is what now carries the advice to
see a doctor, so the clinician should confirm it.

### 4. A weak or failed movement no longer stops the patient by itself (for the clinician)

Under the focused follow-up policy, weakness or inability on one movement asks
the precise canonical questions (`unable`, `tingling`, `numb`) instead of
forcing a stop. If the patient answers "no" to those, movements continue. The
old negative cannot clear the new evidence; a fresh answer is required. This
is a deliberate reduction in referrals and needs clinician sign-off.

## Earlier findings

| Finding at `shoulder-1` | State |
| --- | --- |
| Redness with "not sure" about infection risk was SAFE | **Resolved in v1.2.** `infection_risk` is required when `redness` is yes: missing gives `M_infection_risk`, unknown gives `U_infection_risk`, an explicit "no" can clear, "yes" fires `R_local_infection_risk`. Confirmed in both languages and through the API. |
| A red or warm joint alone is not a red flag | Unchanged by design: it now requires the infection-risk answer, and adds no rule of its own. Still for the clinician. |
| Single-answer rules are broad (injury alone, sudden onset alone) | Unchanged. Still for the clinician. |
| `fever` and `cancer` each ask about two things | Unchanged. Still for the clinician. |
| `R_injury_unable` never fires alone; `verdict` and `defaultVerdict` are unread | Unchanged; no action needed. |

## Results to quote

Run on branch `feature/C-server`, which includes `feature/A-gate` at `d002a65`.
Locally on Python 3.14 and Node 22; CI uses Python 3.11 and Node 20.

```
python scripts/check_gate_parity.py         Gate parity passed: 47 complete outputs match.
python scripts/check_app_signal_parity.py   App-signal parity passed: 51 complete outputs match.
cd server && ruff check .                   All checks passed!
cd server && pytest -q                      8 failed, 2463 passed
```

All 8 failures are findings 1 and 2: seven in `test_rules_have_sources.py` and
`test_gate.py::test_danger_cases_come_first`. No other test fails.
