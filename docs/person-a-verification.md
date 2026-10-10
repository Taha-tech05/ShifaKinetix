# Person A verification — 2026-10-10

Draft, awaiting clinician review. Demo only, not for real patients.

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
