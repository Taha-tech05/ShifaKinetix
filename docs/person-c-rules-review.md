# Person C: independent review of the shoulder gate rules

Status: draft, awaiting clinician review. Demo only, not for real patients.

Reviewed by Person C (Saud) on 2026-10-12, at content version `shoulder-1`:
`shared/gate_rules.json`, `shared/questions_shoulder.json`,
`shared/clinical_sources.json`, `shared/gate_test_cases.json` and
`docs/gate-contract.md`.

This is an engineering review of structure, consistency and the "not sure never
means no" policy. It is not a clinical review and approves no clinical content.
Every label stays "draft, awaiting clinician review".

## Outcome

Approve the contract and the 40 fixtures for merge, with one change requested
before any patient-facing use (finding 1) and four notes for the clinician
reviewer. No rule or fixture was changed in this review; changes to
`shared/gate_rules.json` need both A and C.

## What was checked

| Check | Result |
| --- | --- |
| Questions and rules carry the same content version | Yes, `shoulder-1` |
| Every rule clause names an existing question | Yes, 19 rules |
| Every `equals` value is valid for its question type | Yes |
| Every rule and question has a non-empty `source` listed in `clinical_sources.json` | Yes |
| Every rule and question carries the draft label; none says validated | Yes |
| Every rule is exercised by at least one fixture | Yes |
| Every danger answer on a question has a single-clause rule | Yes |
| Danger cases come first in the fixture file | Yes |
| Python evaluator gives the complete expected output on all 40 fixtures | Yes |
| Python and TypeScript complete outputs are identical on all 40 fixtures | Yes |
| Python and TypeScript agree on 1,006 random intakes, about a quarter malformed | Yes (one-off run, not in CI) |

## Findings

### 1. "Not sure" about infection risk is treated as "no" (change requested)

`R_local_infection_risk` fires on `redness = true` and `infection_risk = true`.
`infection_risk` is an optional question, so the gate does not track its
uncertainty. Measured with the current evaluators:

| Answers (everything else "no") | Verdict |
| --- | --- |
| `redness` yes, `infection_risk` yes | RED_FLAG |
| `redness` yes, `infection_risk` not sure | SAFE |
| `redness` yes, `infection_risk` not sure after clarification | SAFE |
| `redness` yes, `infection_risk` never asked | SAFE |

A patient with a red, warm, painful joint who does not know whether they have
diabetes or reduced immunity is cleared for movements. That contradicts the
team rule that an unknown answer to a danger question is never treated as
safe. Options, for A and C to agree and the clinician to confirm:

- make `infection_risk` a required question, so uncertainty becomes CLARIFY and
  then RED_FLAG like the other 16; or
- give `redness` a danger answer of its own (see finding 2), which makes the
  combination rule informational.

Either needs new fixtures in both languages. The server's doctor-only ranking
already flags joint infection first when `redness` is yes, but that is not a
substitute for the gate.

### 2. A red or warm joint alone is SAFE (for the clinician)

`redness` is the only required question with no danger answer. It contributes
only through two combination rules (with `fever`, with `infection_risk`). This
looks deliberate and is described in the clinician summary. It is the single
place where a "yes" to a required safety question does not refer the patient,
so it deserves an explicit clinician decision.

### 3. Single-answer rules are broad (for the clinician)

Sixteen rules fire on one answer, for example any pain that began after an
accident or injury, any sudden onset, or "feverish or generally unwell". That
errs towards referral, which is the acceptable direction, but few demo cases
will reach the movement stage. The normal-case demo needs all sixteen required
answers negative.

### 4. Two questions ask about more than one thing (for the clinician)

- `fever`: "Do you feel feverish or generally unwell?"
- `cancer`: "Is this new, unexplained shoulder pain and have you had cancer?"

A "yes" to either part answers the whole question. Splitting them would make
the audit log say exactly what the patient reported.

### 5. Notes that need no action

- `R_injury_unable` can never fire without `R_injury` and `R_unable`. It adds an
  explicit reason to the audit row and changes no verdict.
- `verdict` on each rule and `defaultVerdict` on the file are not read by either
  evaluator; the contract fixes the priority as RED_FLAG, CLARIFY, SAFE.
- `pain_score`, `duration` and `side` are stored as context and used by no rule.
- The NICE CKS source is listed as unverified and supports no rule, as stated.

## Results to quote

Run on branch `feature/C-server`, which includes `feature/A-gate` at `f453217`.

```
python scripts/check_gate_parity.py         Gate parity passed: 40 complete outputs match.
python scripts/check_app_signal_parity.py   App-signal parity passed: 41 complete outputs match.
cd server && ruff check .                   All checks passed!
cd server && pytest -q                      1119 passed
```

Run locally on Python 3.14 and Node 22; CI uses Python 3.11 and Node 20.
