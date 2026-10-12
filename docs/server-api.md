# Server API contract (Person C)

Status: draft, awaiting clinician review. Demo only, not for real patients.

This answers `docs/person-c-integration-request.md`. Everything under
"Implemented" exists in `server/app/api.py` and is covered by
`server/tests/test_api.py`. "Proposed" items are for A and B to agree before
anyone builds on them.

Updated 2026-10-13 for gate contract v1.2 (content `shoulder-2`): persistent
uncertainty stays CLARIFY, `infection_risk` is required when `redness` is yes,
app signals ask focused follow-ups instead of `APP_REVIEW_*` stops, the server
derives safety signals from raw movement results, and movement ids are the
app's ids.

## Running it

```powershell
cd server
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env          # then set SHIFA_DEV_LOGIN=1 for local work
.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Development URL: `http://<laptop-ip>:8000` on the same Wi-Fi as the phone
(`http://10.0.2.2:8000` from the Android emulator). Interactive list of
endpoints: `/docs`. There is no hosted URL yet.

Database: a local SQLite file by default; PostgreSQL when `DATABASE_URL` is set.

## Authentication and sessions (implemented)

Every endpoint except `GET /health` and dev login needs
`Authorization: Bearer <token>`. Tokens are opaque random strings, valid for 12
hours. The server stores only a SHA-256 hash of each token.

| Situation | Status | `detail.code` |
| --- | --- | --- |
| No header, wrong scheme, unknown or expired token | 401 | `NOT_AUTHENTICATED` |
| Patient calls a doctor-only endpoint | 403 | `DOCTOR_ONLY` |
| Doctor calls a sync endpoint | 403 | `PATIENT_ONLY` |
| Patient touches an intake that is not theirs, or does not exist | 403 | `NOT_YOUR_INTAKE` |
| Doctor asks for an intake that does not exist | 404 | `INTAKE_NOT_FOUND` |

All errors have the body `{"detail": {"code": "...", "message": "..."}}`.

Roles are `patient` and `doctor`, fixed when the account is created; an account
cannot change role. The role comes from the server session, never from the
request, so a client-side role picker has no effect.

Getting a token, development only (`SHIFA_DEV_LOGIN=1`; otherwise 404):

```http
POST /auth/dev-login
{"userId": "demo-patient", "role": "patient"}

200 {"token": "<token>", "tokenType": "Bearer", "expiresAt": "2026-10-13T02:00:00+00:00",
     "user": {"id": "demo-patient", "role": "patient", "displayName": ""}}
```

`python -m app.seed` prints tokens for `demo-patient` and `demo-doctor` without
enabling dev login. Keep tokens out of commits and group messages. Real login
(passwords or OTP) is not built; that is future work.

Intake ownership: the first event for an `intakeId` creates the intake and
makes the caller its owner. Any doctor can read any intake. That is a demo
simplification; a real deployment needs a doctor-to-patient assignment.

## Offline answer sync (implemented)

```http
POST /sync/answers            patient accounts only
{
  "idempotencyKey": "b1f0c1e2-...",
  "intakeId": "intake-7f3a",
  "contentVersion": "shoulder-2",
  "answer": {"questionId": "injury", "type": "yesno", "value": false, "state": "answered"}
}

200
{
  "status": "stored",
  "idempotencyKey": "b1f0c1e2-...",
  "intakeId": "intake-7f3a",
  "eventSeq": 42,
  "contentVersion": "shoulder-2",
  "serverTime": "2026-10-12T14:03:11.120000+00:00",
  "answerValid": true,
  "gate": {"verdict": "CLARIFY", "firedRules": [ ... ]}
}
```

This is exactly the event `IntakeStore.sync(send)` already produces.

- **Durable acknowledgment.** A 200 is sent only after the event and the audit
  row for its gate run are committed in one transaction. Resolve `send` on 200
  and on nothing else.
- **Idempotency.** The same `idempotencyKey` with the same event returns 200
  with `"status": "duplicate"` and the original `eventSeq`; nothing new is
  stored. This covers a retry after a lost response. The same key with a
  different event returns 409 `IDEMPOTENCY_KEY_REUSED`.
- **Assembled evaluation.** `gate` is computed from the latest stored answer to
  every question in the intake, never from the single event. One answer on a
  new intake therefore returns CLARIFY with the missing questions.
- **Client verdicts are ignored.** Extra fields such as `gate` or `verdict` in
  the request are not read.
- **Changed answers and clarification.** Send a new event with a new key. The
  latest event for a question is the current answer; earlier ones stay in the
  history. `clarificationAttempted` is kept as sent.

| Situation | Status | `detail.code` | What the app should do |
| --- | --- | --- | --- |
| Stored, or already stored | 200 | | Remove the event from the queue |
| Missing or wrong-typed envelope field | 422 | `EVENT_MALFORMED` | Bug in the app; the event can never succeed |
| `contentVersion` differs from the server's | 409 | `CONTENT_VERSION_MISMATCH` | Keep queued; the app must be updated |
| Key reused for a different event | 409 | `IDEMPOTENCY_KEY_REUSED` | Bug in the app |
| Not signed in | 401 | `NOT_AUTHENTICATED` | Keep queued; sign in again |
| Intake belongs to another account | 403 | `NOT_YOUR_INTAKE` | Keep queued; do not retry blindly |
| Two copies raced and the retry also failed | 503 | `TRY_AGAIN` | Keep queued; retry |
| Network failure or timeout | | | Keep queued; retry |

Two policies worth agreeing explicitly:

- **Content version.** The server evaluates one version, the one in
  `shared/questions_shoulder.json` (now `shoulder-2`). An event written for
  another version is refused with 409 and not stored, because its answers
  cannot be evaluated against different rules. This matches the current client,
  whose sync stops at old-version records. Open with A: whether the server
  should instead accept and archive old-version events without evaluating them,
  so the phone queue can drain. Nothing is migrated automatically.
- **Invalid answers.** An answer that fails validation (unknown question, wrong
  type, string instead of boolean) is still stored and acknowledged, with
  `"answerValid": false`, so one bad event cannot block the queue behind it.
  The gate then fails closed with `INPUT_INVALID` (RED_FLAG) until a valid
  answer to that question arrives.

## Movement and context sync (implemented on the server; proposed to A and B)

The phone currently keeps raw app answers and movement results as a local
snapshot. Proposal: upload that snapshot as an event, with the same envelope.

```http
POST /sync/context            patient accounts only
{
  "idempotencyKey": "c7d9...",
  "intakeId": "intake-7f3a",
  "contentVersion": "shoulder-2",
  "context": {
    "regionId": "shoulder_right_front",
    "appAnswers": [ {"questionId": "Q_UNABLE_TO_MOVE_ARM", "type": "yesno", "value": false, "state": "answered"} ],
    "movements":  [ {"movementId": "sideways_raise", "painful": true, "weak": false, "unableToDo": false,
                     "measuredAngle": null, "state": "done"} ]
  }
}
```

The response has the same shape as answer sync, without `answerValid`. Each
snapshot is appended; the latest one is the current context. Idempotency,
ownership and errors are the same as for answers.

Send the RAW app answers (`Q_BASICS_HOW`, `Q_ST_NUMB`, `Q_ST_TINGLE`,
`Q_ST_BONE_POINT`, the narrowing questions) and the RAW movement results. The
app does not need to send derived answers such as `Q_UNABLE_TO_MOVE_ARM`.

How the server uses it:

- `server/app/session_gate.py` runs the same pipeline as the phone:
  `structuredGateInputs` (derive signals from the raw answers and movements),
  `withMovementUncertainty`, then the session adapter, then the canonical gate.
  Canonical negatives plus a raw `unableToDo: true` or `weak: true` therefore
  give CLARIFY with the focused follow-ups, not SAFE.
- Derived answers the app does send are kept alongside the server's own, so a
  signal reported by either side is asked about.
- Canonical question ids inside `appAnswers` are ignored. Safety answers come
  only from `/sync/answers`.
- A malformed snapshot is stored and makes the gate fail closed.
- `shared/app_signal_test_cases.json` (51 raw cases, danger first) is checked
  in both languages by `scripts/check_app_signal_parity.py`, which runs the
  real `gateInputs.ts`, `sessionEvaluator.ts` and `sessionAdapter.ts`.

### Focused follow-ups are resolved by the server (implemented)

A positive or unknown app signal asks the precise canonical question again.
Until it is answered for the current evidence the gate presents that question
as unknown (`U_<id>`, CLARIFY). A confirmed canonical "yes" always stays "yes".

The phone marks a follow-up as answered with a review fingerprint
(`Q_SAFETY_REVIEW_<id>`). The server does not read those records. It decides
from the order in which it received things:

1. For each canonical question, the evidence is the set of app signals asking
   about it, plus the movement results for `unable`, `numb` and `tingling`.
2. The evidence starts at the first of the latest run of context snapshots
   that carry it unchanged. Evidence that changes and changes back starts
   again, so an old answer is not revived.
3. The follow-up is resolved only if an answer event for that question was
   stored after that snapshot. The answer itself is then evaluated normally:
   "no" can clear, "yes" fires the unchanged rule, "not sure" stays CLARIFY.

| Sequence the server receives | Gate |
| --- | --- |
| `unable` = no, then a movement with `unableToDo` | CLARIFY `U_unable` (the old "no" cannot clear new evidence) |
| ... then `unable` = no again | SAFE |
| ... then a further movement result | CLARIFY `U_unable` (changed evidence) |
| ... then `unable` = no again | SAFE |
| Evidence removed, then the same evidence again | CLARIFY (not revived) |
| Same snapshot re-sent, or only the region changed | Unchanged |

**Ordering requirement for the app (to agree):** sync the context snapshot
that contains the new evidence before the answer event that reviews it. If the
answer arrives first, the server cannot tell it was given for that evidence and
stays at CLARIFY until the question is answered again. That fails closed, but
it would show the patient a different verdict from the phone. Simplest client
rule: flush the context snapshot, then the answer outbox.

Not covered: two requests for the same intake arriving at the same instant can
be ordered either way. The demo has one phone per intake.

### Movement ids (reconciled with the app)

The server now uses the six ids in `mobile/src/data/movements_shoulder.json`.
A test fails if the two sets ever differ.

| App movement id | Clinical test it adapts | Used by server narrowing for |
| --- | --- | --- |
| `sideways_raise` | painful arc | supraspinatus |
| `can_position_hold` | empty can | supraspinatus |
| `outward_push_elbow_at_side` | resisted external rotation | infraspinatus, teres minor |
| `hand_behind_back` | lift-off, self-administered | subscapularis |
| `belly_press` | belly press | subscapularis |
| `forward_raise` | none | recorded and shown to the doctor; no muscle profile yet |

Movement `state` is `answered` or `unknown`, as in `mobile/src/movement/result.ts`.
An id outside this list is stored, shown to the doctor as a fact and listed in
`movementsNotUsed`.

Each server muscle in `shared/narrowing_shoulder.json` now also names the app's
structure ids (`structureIds.right` / `.left`, for example
`supraspinatus_muscle_right`), checked against `shared/regions_shoulder.json`.

Still open for B and C: the narrowing output still uses the short muscle id
(`supraspinatus`), not the side-specific structure id; and the app's own live
narrowing (`shared/narrowing_bank_shoulder.json`, marked "Person C replaces")
is separate from the server's. We need to agree which one the patient sees.

## Server safety enforcement (implemented)

Every read below recomputes the gate from stored data first and writes an audit
row. Narrowing, ranking and the model write-up run only when that verdict is
SAFE. RED_FLAG and CLARIFY return no differential and no candidate muscles.

```http
GET /intakes/{intakeId}/gate            owner or doctor
200 {"verdict": "RED_FLAG", "firedRules": [ ... ]}
```

## Patient report (implemented)

```http
GET /intakes/{intakeId}/report          owner or doctor
200 {"audience": "patient", "intakeId": "...", "banner": "Demo only, not for real patients.",
     "talkToDoctor": true, "status": "READY",
     "musclesThatMayBeInvolved": ["supraspinatus"], "cluster": false, "guidance": "..."}
```

`status` is `READY` (SAFE), `REFER` (RED_FLAG) or `INCOMPLETE` (CLARIFY); the
last two carry a fixed `message` and no muscles. This report never contains the
differential, a condition name, a score or fired rules. Every string passes the
patient text filter.

## Doctor report (implemented)

```http
GET /intakes/{intakeId}/doctor-report   doctor accounts only

200
{
  "audience": "doctor",
  "label": "draft, awaiting clinician review",
  "intakeId": "intake-7f3a",
  "facts": [ {"label": "Tapped region", "value": "shoulder_right_front"},
             {"label": "Do you have chest pressure or tightness now?", "value": "No"},
             {"label": "Movement sideways_raise", "value": "painful"} ],
  "gate": {"verdict": "SAFE", "firedRules": []},
  "differential": [
    {"condition": "Subacromial impingement",
     "reason": "... (5 of 5 features confirmed, 0 unknown.)",
     "source": "Michener 2009, Arch Phys Med Rehabil 90(11):1898-1903"}
  ]
}
```

The six fields of `mobile/src/reports/doctorReport.ts` are always present with
those types, so `authorizedReport()` accepts the response as it is. Extra,
optional fields: on the report `banner`, `downstream` (`ranked` or
`blocked_by_gate`), `narrowing`, `muscleNote`, `movementsNotUsed`, `writeUpBy`;
on each differential item `conditionId`, `rank`, `flagged`, `score`,
`matchedFacts`, `contradictedFacts`, `unknownFacts`, `rankRationale`, `label`.

- Anonymous: 401. Patient, including the intake's owner: 403 `DOCTOR_ONLY`.
- When the gate is not SAFE, `differential` is `[]` and `downstream` is
  `blocked_by_gate`; the doctor sees the facts and the fired rules.
- The order of `differential` is decided by code. The model, when a key is
  configured, only writes `reason`; it cannot add, remove or reorder items.
- Each view is recorded in `doctor_actions`.

## Audit and history (implemented on the server; plan for the app)

```http
GET /intakes/{intakeId}/audit           doctor accounts only
200 {"intakeId": "...", "ruleVersion": "shoulder-2",
     "gateRuns": [ {"id": 1, "ts": "...", "cause": "answer_sync", "verdict": "CLARIFY",
                    "firedRules": [...], "matchedAnswers": [...], "ruleVersion": "shoulder-2"} ],
     "answerHistory": [ {"seq": 1, "receivedAt": "...", "questionId": "injury", "answer": {...},
                         "contentVersion": "shoulder-2", "idempotencyKey": "..."} ],
     "contextHistory": [ ... ],
     "doctorActions": [ {"id": 1, "at": "...", "doctorId": "demo-doctor", "action": "viewed_doctor_report"} ]}
```

| Table | One row per | Kept |
| --- | --- | --- |
| `answer_events` | Synced safety answer, including each change and each clarification | The answer as sent, content version, time received |
| `context_events` | Synced context snapshot | Region, raw app answers, movement results |
| `audit_log` | Gate run on the server, including SAFE | Verdict, fired rules with sources and reasons, matched answers, rule version, cause, time |
| `doctor_actions` | Doctor viewing a report or the audit trail | Doctor id, action, time |

All four are append-only: a database trigger rejects UPDATE and DELETE (and
TRUNCATE on PostgreSQL). Tests prove this on SQLite; the PostgreSQL triggers
run in the `server-postgres` CI job and have not been run on a developer
machine.

What this does not cover yet:

- The server sees an answer when it is synced, with the server's receive time,
  not the time the patient tapped. If the phone's own timestamp matters, add an
  optional `answeredAt` to the event (proposed).
- Gate runs made on the phone while offline are not uploaded. The server
  re-runs the gate on the same answers when they arrive.
- B's live narrowing history (`supersededAt` entries) is still in phone memory.
  Proposed: include it in the context snapshot under a `history` key; the
  server already stores whatever the snapshot contains.

## Implemented and not implemented

| Item from the request | State |
| --- | --- |
| Python gate, contract v1.2, complete-output parity on 47 fixtures | Implemented |
| Rules review | Done: `docs/person-c-rules-review.md` |
| Focused follow-ups for live app signals, with shared fixtures | Implemented, 51 raw fixtures in both languages |
| Server derives safety signals from raw movement results | Implemented |
| Server-owned follow-up resolution (no client review tokens) | Implemented; client sync order to agree |
| Movement ids reconciled with the app | Done: six shared ids |
| Answer sync endpoint with idempotency and durable ack | Implemented |
| Movement and context sync | Implemented on the server; contract proposed, not yet agreed |
| Doctor-only report endpoint, 401 and 403 tests | Implemented |
| Server recomputes safety before narrowing and ranking | Implemented |
| Append-only audit and history | Implemented on the server; app-side history upload proposed |
| Real login, hosted URL, doctor-to-patient assignment | Not implemented |
| Old-version (`shoulder-1`) event handling | 409 today; archive option to agree with A |
| One narrowing for the patient: app's live bank or the server's | Not agreed; needs B and C |
