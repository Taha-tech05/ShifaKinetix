# Person A handoff ? 2026-10-13

Draft, awaiting clinician review. Demo only, not for real patients.

## Current PR decision

PR2 stays draft. PR8 at f6c5601 is reviewed but must not merge yet. PR7 remains
merged at 52a5486; no newer PR7 revision was found. Full evidence and runnable
regressions: [pr8-review.md](pr8-review.md).

Saud now implements v1.2 / shoulder-2: independently verified 47 canonical and
51 app-signal outputs match. His raw-movement derivation and six movement IDs
are updated. His written independent engineering review of shared rules exists
in PR8; clinician review is still pending.

A corrected missing source/labels on seven fixtures and restored danger-first
ordering without changing any inputs or expected gate outputs. With that patch,
all 2471 existing server tests pass. However, four added API/migration tests
expose three additional problems: invalid safety IDs disappear, incomplete
movement flags can grant SAFE, and legacy migration can revive an old negative
answer. Saud must resolve these in the same PR8. No server code was changed or
merged into A during this review.

CI now includes PRs targeting feature/A-gate, and the server job checks the new
boundary regressions once the API exists. Saud must merge the latest A branch
so PR8 receives the fixture fixes, tests and CI change. Keep independent review
and normal merge commits; do not push directly to develop/main.

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

- Last full mobile run: 426 tests; last real SQLite run: 15 tests, all passing.
- This review: 71 targeted mobile gate/integrity tests pass, including the new
  fixture provenance/order regression. TypeScript and full lint pass (25 existing
  warnings, no errors).
- Isolated PR8 with corrected fixtures: 2471 existing server tests pass; Ruff
  passes; 47 canonical and 51 app-signal full-output parity cases pass.
- Four additional boundary regressions FAIL and are explicit merge blockers.
- Android export previously passed; not repeated for this data/test/CI change.
- Local Python 3.12 / Node 22.16. CI uses Python 3.11 / Node 20, and Node 22 for
  SQLite. PostgreSQL and installed-phone behavior remain unverified.

## Remaining work by owner

1. Saud: fix the three reproduced PR8 issues, merge A's latest corrections,
   rerun existing and review tests, and obtain CI results including PostgreSQL.
2. A + Saud: implement durable ordered context/answer sync and authenticated
   transport. Do not upload the latest snapshot before an old answer backlog:
   server receive order could mistake old negatives for fresh follow-ups.
   Agree version-aware handling of shoulder-1 events without silently deleting
   them. The current local snapshot is not a complete event history.
3. Taha + Saud: agree one narrowing bank/output and map results to the app's
   side-specific structures. Matching movement IDs alone does not finish this.
4. A + team: connect the authorized doctor-report response, finish required
   audit/history transport, and test retry, lost acknowledgement, ownership and
   patient denial from doctor-only data using the real API.
5. Taha + A: build/test on Android. Cover SAFE, danger, repeated unknown,
   conditional infection risk, new movement signals, failed saves, force-close
   and airplane-mode resume. Record commit, device, build and results.
6. Supervisor/doctor: review the shoulder summary and questions/rules; keep all
   clinical labels draft until that review actually happens. Names are omitted.
7. Repository administrator: confirm required independent reviews and CI checks
   on protected branches. Zaid has no repository admin access.

The long final project report has not been started; source records, revision IDs,
verification history and this review are retained for it.
