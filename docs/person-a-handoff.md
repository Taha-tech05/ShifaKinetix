# Person A handoff after integrating PR #7

Draft, awaiting clinician review. Demo only, not for real patients.

A's feature/A-gate now includes PR #7 at 52a5486 and its PR #6 lint fixes,
plus A's real shoulder safety integration and delayed-save guard fix. See [safety-integration.md](safety-integration.md) for the exact
contracts, adapter policy, persistence boundaries and B-owned follow-up work.
PR #2 remains draft and must not merge while required checks fail.

## Implemented by Zaid

- 20 sourced shoulder questions, 19 canonical rules and 40 shared parity fixtures.
- Strict TypeScript evaluator and an adapter for B's broader answer templates.
- Full gateOutput in B's store through the agreed one-import replacement.
- Existing danger/reask/safe routes now use real questions, saved typed answers,
  one-time clarification and guarded handoff into B's exact/region flow.
- SQLite safety answers, trusted question/rule cache and transactional retry outbox.
- Explicit start/resume, shoulder context restoration and fresh gate evaluation.
- Protected screens wait for saved clearance; changed inputs invalidate it.
- Doctor-report presentation component, review summary, review log and panel register.
- Integration, evaluator and actual SQLite tests; CI retains parity and lint checks.

The old top-level /questions and /result demo routes are not the team app's entry
flow. B's report/result.tsx, report/movement.tsx, flow/live.ts, components and theme
come from Taha's commits; A's follow-up changes the shared safety guard and tests. Do not integrate the old standalone
result over B's narrowing result.

## Current verification

- TypeScript: passes.
- Mobile tests: 403 passing, including real-gate integration tests.
- Actual SQLite tests: 11 passing, including restart and persistent clarification.
- Full lint: passes with 0 errors and 25 warnings.
- Combined Android Metro export: passes (not an APK/device test).
- Python/TypeScript parity: 40/40 cases fail in C's placeholder Python gate with
  KeyError: when. Do not weaken the fixtures to accept the placeholder.

## Taha: required follow-up

PR #7 now guards initial/fallback narrowing and awaits live submit/back checkpoints.
PR #6 fixes the blocking lint errors. A fixed the guard interaction that previously
redirected a verified intake to danger while its new answer was still saving.
Protected content waits, then the real gate decides whether to continue or stop.
Tests cover delayed normal/unknown saves, failure and reset with the actual screen.

Remaining:

1. Verify protected branches require independent review and mobile, server,
   gate-parity, offline-storage checks. Zaid does not have repository admin access.
2. Build the APK and coordinate the real-device acceptance below.

## Saud: required follow-up

Full request and API contracts: [person-c-integration-request.md](person-c-integration-request.md).

Implement docs/gate-contract.md in server/app/gate.py and run:

```powershell
python scripts/check_gate_parity.py
```

Review A's rules independently and review the app-signal adapter policy. Server
handling must preserve these signals too; the 40 canonical fixtures do not by
themselves prove full app-input parity. C also owns authenticated doctor-only
responses, the independent server gate, ranking and the append-only audit log.

Connect IntakeStore.sync(send) with an authenticated transport. Resolve send only
after durable acknowledgment and deduplicate idempotencyKey. Failed requests
remain queued. No successful upload or authentication is simulated.

## Human checks and unfinished acceptance

- Faculty supervisor and doctor review of clinician-shoulder-summary.md is pending;
  reviewers are available, but availability is not approval. Names are omitted.
- On an actual Android phone: complete a fictional all-negative intake, test
  immediate danger, Not sure twice, a new positive/unknown live signal, and a
  failed SQLite write. No movements should open without confirmed SAFE.
- In airplane mode: force-close/relaunch and explicitly resume the same assessment.
  Verify values, clarification attempts and outbox events survive. A new intake
  must never inherit old clearance. Test the integrated live save/back/review flow on the device.
- After C connects transport: test acknowledgment/retry and patient rejection
  from doctor-only endpoints. Record device, build/commit and results.

## Run locally

```powershell
cd mobile
npm ci
npm run typecheck
npm run lint
npm test -- --runInBand
npm run test:storage
npm start
```

App/ordinary CI use Node 20; real SQLite tests use Node 22.13+. Local verification
used Node 22.16/Python 3.12, while server CI uses Python 3.11. Native SQLite is the
target; web SQLite is not configured. Dependency installation reported 56 audit
findings (15 moderate, 41 high); no forced dependency upgrade was performed.
