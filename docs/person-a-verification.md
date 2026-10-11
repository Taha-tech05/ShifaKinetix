# Person A verification — 2026-10-10

Draft, awaiting clinician review. Demo only, not for real patients.

## Team-app integration update, 2026-10-12

Merged develop e4866e1, including PRs #4 and #5, into feature/A-gate.
TypeScript and targeted lint for changed safety implementation pass. The combined
Android Metro export passes; this does not establish native runtime acceptance.

The complete mobile run passed 387 tests in 22 suites. After the final uncertainty
regression and type annotation changes, all 88 affected gate/store/integration
tests passed (including the added case), bringing covered tests to 388. The actual
SQLite run passed all 11 tests, including integrated resume, saved-clearance
validation and disk-write failure. Narrowing/UI unit suites inject a gate outcome;
the separate integration suite uses the real gate/store/live-submit path.

Full lint fails with 75 errors in nine B-owned files, each confirmed unchanged
from develop after normalizing line endings. File counts and required B changes
are in person-a-handoff.md. No lint rules or shared parity fixtures were disabled.
Parity was rerun: all 40 canonical cases still fail with Python KeyError: when.

B's report/result.tsx, report/movement.tsx, flow/live.ts, components and theme
are unchanged. Shared clinical JSON and server code are unchanged this round.
The new app-signal policy is documented in safety-integration.md and remains
draft, awaiting clinician review.

Not completed: B's awaited live-event checkpoint/pre-guard narrowing changes,
server signal handling/transport/authorization, Android/airplane-mode acceptance,
clinician review and administrator verification of branch protection. The session
snapshot is not a persistent live-history/server audit implementation.

## Original standalone implementation (2026-10-10)

| Check | Observed local result |
|---|---|
| TypeScript `npm test -- --runInBand` | 67 passed: 40 shared gate cases, 23 integrity/provenance checks, 4 report-access checks |
| Real SQLite `npm run test:storage` | 8 passed, including reopen, transaction rollback, retry ordering and corruption handling |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npx expo export --platform android --output-dir dist --max-workers 2` | Passed; Android JavaScript/Hermes bundle produced, not an installed APK |
| Python source labels and health tests | 80 passed using `pytest -q tests/test_rules_have_sources.py tests/test_health.py` |
| `python scripts/check_gate_parity.py` | FAILED: all 40 cases hit C's placeholder evaluator (`KeyError: when`) |
| `git diff --check` | Passed |
| Real Android/airplane-mode interaction | Not performed; acceptance script in handoff |
| Clinician review | Not performed; reviewers available, summary prepared |
| Branch protection | Not modified: Zaid account has no admin permission |

Local tools: Node 22.16.0, Python 3.12. CI is configured for Node 20 mobile/gate,
Python 3.11 server/parity, and a separate Node 22 real SQLite job. Local results
do not assert GitHub CI results. The Python gate is intentionally not replaced
by A; C must implement the shared contract before this branch can merge.

The npm install reported 61 dependency audit findings (15 moderate, 46 high).
No forced dependency upgrade was applied. Record a separate team dependency
review before any deployment outside the fictional-data demo.
