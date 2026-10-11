# Person A handoff after PRs #4 and #5

Draft, awaiting clinician review. Demo only, not for real patients.

A's feature/A-gate now contains Taha's merged app plus the real shoulder safety
integration. See [safety-integration.md](safety-integration.md) for the exact
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
have not been edited by A during integration. Do not integrate the old standalone
result over B's narrowing result.

## Current verification

- TypeScript: passes.
- Mobile tests: 388 passing, including real-gate integration tests.
- Actual SQLite tests: 11 passing, including restart and persistent clarification.
- Lint on A's changed safety implementation: passes.
- Combined Android Metro export: passes (not an APK/device test).
- Full lint: blocked by 75 errors in nine B-owned files, unchanged from develop.
- Python/TypeScript parity: 40/40 cases fail in C's placeholder Python gate with
  KeyError: when. Do not weaken the fixtures to accept the placeholder.

## Taha: required follow-up

1. Move pre-guard narrowing in flow/live.ts seedLiveState and the report/result
   fallback behind verified clearance. Await the safety checkpoint for live
   submit/back before advancing, so a new event cannot be lost on restart.
   Exact details and the exported API are in safety-integration.md.
2. Fix the inherited full-lint errors. File counts from the integration run:

| File (under mobile/src/) | Errors |
| --- | ---: |
| app/dev/anim.tsx | 2 |
| app/report/movement.tsx | 7 |
| app/report/result.tsx | 47 |
| components/body3d/Body3D.tsx | 6 |
| components/body3d/SegmentedBody.tsx | 5 |
| components/body3d/usePack.ts | 1 |
| components/body3d/useViewerGestures.ts | 2 |
| components/movement/MovementPlayer.tsx | 3 |
| components/movement/MovementStage.tsx | 2 |

These failures became visible when A's lint CI was combined with B's app; they
are not claims that B's previous CI included lint. Keep the check enabled.

3. Verify protected branches require independent review and mobile, server,
   gate-parity, offline-storage checks. Zaid does not have repository admin access.
4. Build the APK and coordinate the real-device acceptance below.

## Saud: required follow-up

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
  must never inherit old clearance. Test live-event persistence after B's async fix.
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
