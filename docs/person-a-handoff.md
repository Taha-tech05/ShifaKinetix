# Person A: running and integrating the shoulder demo

Draft, awaiting clinician review. Demo only, not for real patients.

## Run

```powershell
cd mobile
npm ci
npm run typecheck
npm run lint
npm test -- --runInBand
npm run test:storage
npm start
```

The app and ordinary CI use the team's Node 20 baseline. The real SQLite test
suite (`test:storage`) uses Node 22.13+; CI runs it in a separate Node 22 job.
This laptop has Node 22.16 and Python 3.12; CI retains Python 3.11. Tests here
do not prove real Android rendering, installation, or airplane-mode behavior.

The Expo Router entry launches a small A-owned safety demo. The original
`App.tsx` is retained for B to reconcile with the full shell. There is no viewer,
ranking, AI, login, server upload, or production doctor route in this demo.
Patient screens have no differential data or doctor-role toggle.

## B: mobile integration

- Integrate `src/app/questions.tsx` and `result.tsx` after confirmed shoulder
  selection. Pass a fresh persisted `intakeId`, not a verdict in route params.
- Only allow downstream movement/AI after `store.savedGate(intakeId)` returns
  SAFE. Repeat that check before committing any downstream response. Never
  infer clearance from the fact a route was visited.
- The question screen repeats a required unknown once and persists that fact.
  A subsequent unknown routes to clinical review. Reloading cannot erase it.
- SQLite errors stop the flow. Never replace a failed read with an empty or
  negative answer list. New/follow-up symptoms require a new intake.
- `DoctorReportScreen` is an integration component, not a patient route.
  Supply authenticated doctor session access and an authorized API loader.
  Server rejection must propagate. Do not provide a user-selectable role.
  The client guard alone is not an authorization boundary.
- Native SQLite is the target. The standalone demo does not configure web
  SQLite/SharedArrayBuffer and must not be advertised as a working web app.

## C: required backend work

Implement `docs/gate-contract.md` in `server/app/gate.py`, then run:

```powershell
python scripts/check_gate_parity.py
```

All 40 shared cases assert complete outputs. The existing placeholder fails
on the new `all` clauses; this is an explicit merge blocker, not a skipped test.
C also owns authenticated doctor-only report responses, API authorization,
the independent server gate, ranking and the append-only audit log.

Connect `IntakeStore.sync(send)` with an authenticated transport. Resolve
`send` only after a durable server acknowledgment. Deduplicate its
`idempotencyKey`; an interrupted acknowledgment retries the same event.
Payloads contain `intakeId`, `contentVersion`, and the typed `answer`. The
queue sends in insertion order and never deletes unacknowledged entries.
No endpoint or successful upload is simulated in the current app.

## Real-device acceptance (pending)

Record device model, Android version, APK/commit and observed results:

1. Complete a fictional negative safety screen; see the non-diagnostic result.
2. Start a fresh intake; an injury answer must stop the screen. At evaluator
   level the injury-plus-inability fixture must match all applicable rules.
3. Choose Not sure on a safety item twice; restart and confirm referral persists.
4. Enable airplane mode; force-close and relaunch. Resume the saved intake.
   Confirm typed values and verdict persist and pending updates remain queued.
5. Complete another fictional negative screen entirely offline. Verify the
   same verdict after restart. Never reuse old clearance for a new intake.
6. With C's API connected, reconnect and verify acknowledgment/retry behavior,
   server re-evaluation and rejection of patient access to differential data.

## GitHub and review

All commits belong on `feature/A-gate`. Push that branch and open a **draft** PR
into develop. Request C's rule review through the team's normal process. Do
not merge with failed server/parity checks. A's authorship/self-check is not
a substitute for C's approval. Preserve history with a normal merge commit.

Zaid's authenticated GitHub account has push access but no admin/maintain
permission (checked 2026-10-10). Branch protection could not be inspected via
the protected-settings API; a 404 does not prove protection is absent.
Taha must verify both branches require PRs, independent approval, resolved
conversations, and `mobile`, `server`, `gate-parity`, `offline-storage` checks;
disable force pushes/deletion and direct pushes as appropriate for team roles.
CODEOWNERS listing A and C does not by itself require both people to approve.
Record their review explicitly and configure suitable rules if available.
