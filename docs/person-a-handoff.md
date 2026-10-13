# Person A handoff ? 2026-10-13

Draft, awaiting clinician review. Demo only, not for real patients.

## Current PR decision

The three reproduced PR8 boundary issues are now fixed in [PR9](https://github.com/Taha-tech05/ShifaKinetix/pull/9),
branch feature/A-pr8-safety-fixes, head c188c40. User authorized implementing the
fixes and notifying Saud. A notification with the ready patch was posted on PR8.
Saud should review/merge PR9 into feature/C-server after CI passes; it updates
his existing PR8. Then review/merge PR8 into A and check combined PR2. No direct
push was made to C, develop or main. PR2 remains draft pending integration.

All five PR9 CI jobs passed on c188c40, including server-postgres. Evidence:
https://github.com/Taha-tech05/ShifaKinetix/actions/runs/38340310738

Local validation of the fix branch: 2484 tests pass (2480 server + 4 review
regressions), 47 canonical and 51 app-signal complete outputs match, Ruff passes.
The migration test also verifies that a fresh answer can restore SAFE and that
restarting does not lose that review. Clinical rules and expected shared outputs
are unchanged. GitHub CI/PostgreSQL results are separate from local SQLite tests.

PR7 remains merged at 52a5486; no newer PR7 revision was found. The historical
review and exact reproductions remain in [pr8-review.md](pr8-review.md).
Saud's independent engineering review of shared rules is in PR8. Clinician
review remains pending.

## Implemented by Zaid

- 20 sourced shoulder questions, 19 clinical rules, 47 full-output fixtures.
- Strict TypeScript evaluator and focused follow-ups for broad app signals.
- Conditional infection-risk completeness through shared requiredWhen data.
- Integrated danger/reask/safe/urgent/unclear screens and full gateOutput.
- SQLite answers and transactional retry outbox; explicit start/resume with
  context restoration and fresh gate evaluation.
- Saved-clearance guard: no narrowing while writes are pending or failed.
- Explicit correction with reevaluation; changed evidence invalidates review.
- Doctor-report presentation component, clinician summary, review log, panel
  register, source provenance and engineering verification records.
- Ordered context/answer upload with stable retry keys, verified server
  acknowledgements, intake/account binding and retained local event history.
- Authenticated demo API connection and doctor-report loading inside A's
  safety screens. Tokens remain in memory; the app role picker grants no access.
- Persistence/upload of live answer history, superseded entries, narrowing
  snapshots and client gate records. Server independently recomputes its gate.

These additions are tested against the real PR9 server locally. A hosted API
URL and sign-in setup have **not** been supplied. See [mobile-sync.md](mobile-sync.md)
for demo setup, exact limitations and the phone acceptance checklist.

Taha's live submit/back checkpoint wiring and protected movement/result bodies
are already included through PR7. His report/result, report/movement, flow/live,
components and theme remain B-owned. Old standalone /questions and /result are
not the team app's main flow.

## Current safety behavior

Broad onset, sensory and movement signals request precise follow-ups; they do
not themselves force APP_REVIEW_* stops. Canonical confirmed danger still stops.
An old negative cannot clear new evidence. Repeated unknown remains CLARIFY,
routes to unclear/doctor advice and blocks movements. SAFE is only permission
to continue under the draft gate; it is not a diagnosis or clinical validation.

Redness=true makes infection_risk required: missing/unknown requests clarification;
repeated unknown remains blocked. An explicit negative may clear if everything
else clears; positive risk plus redness uses the existing clinical rule.
Shared content is shoulder-2. Old assessments need a fresh intake; their outbox
records remain preserved but cannot yet sync across content versions.

## Verification and limits

- Current full mobile run: **450 tests**; real SQLite: **20 tests**, all passing.
- Real mobile SQLite + HTTP + PR9 API: **4 integration scenarios pass**, including
  fresh-evidence ordering, lost acknowledgement, restart, live Back history,
  complete gate outputs and authenticated doctor access.
- TypeScript and full lint pass (25 existing warnings, no errors). Android Metro
  export passes; this does not constitute installed-device testing.
- Isolated PR8 with corrected fixtures: 2471 existing server tests pass; Ruff
  passes; 47 canonical and 51 app-signal full-output parity cases pass.
- The four boundary regressions pass on PR9; merge the reviewed fix before PR8.
- Local Python 3.12 / Node 22.16. CI uses Python 3.11 / Node 20, and Node 22 for
  SQLite. PR9's PostgreSQL CI passed; new mobile sync ran locally against SQLite.
  Installed-phone behavior remains unverified. The CI offline-storage job also
  runs HTTP integration once the real server API is present in the branch.

## Remaining work by owner

1. Saud: review/merge the completed fix PR9, check updated PR8 CI, and obtain
   results including PostgreSQL. The fixes no longer need reimplementation.
2. Saud: supply the demo API URL and patient/doctor sign-in provisioning, then
   run the completed mobile sync against that deployment. Ordered transport,
   authenticated client and local end-to-end tests are implemented. Legacy
   assessments without ordered history, and old content versions, stay on the
   device and require a new assessment; no unsafe migration or silent deletion.
3. Taha + Saud: agree one narrowing bank/output and map results to the app's
   side-specific structures. Matching movement IDs alone does not finish this.
4. A + team: confirm the completed doctor-report and audit transport on the
   deployed server/phone. Local real-API verification passes; production login,
   automatic background sync and a phone audit-history viewer are not included.
5. Taha + A: build/test on Android. Cover SAFE, danger, repeated unknown,
   conditional infection risk, new movement signals, failed saves, force-close
   and airplane-mode resume. Record commit, device, build and results.
6. Supervisor/doctor: review the shoulder summary and questions/rules; keep all
   clinical labels draft until that review actually happens. Names are omitted.
7. Repository administrator: confirm required independent reviews and CI checks
   on protected branches. Zaid has no repository admin access.

The long final project report has not been started; source records, revision IDs,
verification history and this review are retained for it.
