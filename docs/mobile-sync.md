# Ordered offline sync and authorized doctor report

Status: draft, awaiting clinician review. Demo only, not for real patients.

## What is complete

A's safety screens have **Saved assessment and sync**. A patient can explicitly
upload the selected saved assessment. A server-authenticated doctor can enter
its ID and load recorded facts and the draft differential. The normal app role
picker does not authorize this endpoint. Differential access is enforced again
by C's server. B's patient result/movement screens and live driver are unchanged.

The client uses C's `/auth/me`, `/sync/context`, `/sync/answers`,
`/intakes/{id}/gate` and `/intakes/{id}/doctor-report` contracts. It checks the
acknowledgement's intake, event key, content version, sequence, answer validity
and gate shape before removing an event from the queue. It never overwrites
local clearance with a server response. New local changes require reevaluation.

Evidence and its reviewing answer are saved in one transaction, evidence first.
The queue preserves original chronology: an old negative cannot review a later
movement. Context uploads contain raw app answers/movements, selection, live
history and narrowing snapshots. Canonical safety answers use answer events;
local `Q_SAFETY_*` review tokens are excluded. Client gate records are audit data,
not server authorization. C derives safety signals and review order independently.

Each event remains in local append-only history after successful upload. Retry
uses the same payload/key, stops on the first failure and preserves later events.
New changes made while uploading remain queued for the next explicit upload.
The first upload attempt binds that intake to the verified account/server;
switching either requires a new assessment. There is no background upload.

Old content and assessments created before ordered history existed remain saved
but cannot upload through this transport. Start a new assessment. A snapshot
cannot reconstruct the chronology of an old answer-only queue. No data is
silently deleted or relabelled as current content.

## Demo connection

Saud still needs to provide the API URL and patient/doctor account provisioning.
This implementation accepts a server-issued bearer token for the demo; it is
not a production login system. Tokens remain in memory and clear on disconnect,
closing the panel, leaving its screen or restarting the app. Do not put tokens
in EXPO_PUBLIC variables, source files, screenshots, PRs or messages.

1. Use the reviewed server containing PR9's fixes. For isolated test data only,
   C's `SHIFA_DEV_LOGIN=1` enables `/auth/dev-login`; it must not be exposed as
   production authentication. See C's server-api.md once the server is merged.
2. Set an optional **public URL only** via `EXPO_PUBLIC_API_URL`, or enter the
   address in the panel. HTTPS is required, except a development build may use
   localhost/private IPv4 HTTP. A phone's localhost is the phone, not the PC;
   use the PC's reachable LAN address for a local phone test.
3. Start a **new** assessment on this version and complete/save its questions.
   Open Saved assessment and sync, enter the address and privately provisioned
   patient token, Connect, then Upload saved assessment.
4. Copy the displayed assessment ID. Disconnect. Connect with the provisioned
   doctor token, enter that ID, then Load doctor report. Disconnect removes it.
   A patient connection never offers that control, and the API denies access.

Sync controls are on A's questionnaire, safety stop and safe handoff screens.
The server audit contains live history; an audit-history browser on the phone
is not included. B/C must still reconcile their narrowing banks and model IDs;
the server differential and B's visual narrowing are not claimed equivalent.

## Reproduce automated verification

Install mobile npm dependencies and C's Python server requirements; use Node 22+
for native SQLite tests. From the repository root:

```text
python scripts/check_mobile_sync.py
```

Before C is merged, `--server-root <path-to-reviewed-server>` permits testing
against an isolated checkout without copying server code. The runner starts a
loopback server with a disposable SQLite database, provisions fictional accounts,
runs the mobile integration suite and terminates the server. It removes the LLM
API key from the child environment. CI runs this in offline-storage once C's API
exists; it does not skip failing tests when the API is present.

## Phone acceptance still required

Record build/commit, device/OS, tester, observed result and any issue. These are
pending, not implied by Metro export or Node SQLite success:

- Complete non-danger answers: SAFE permits movements/narrowing. Confirmed
  danger stops; repeated unknown stays CLARIFY and stops. Test conditional risk.
- Airplane mode: save, force-close, restart, explicitly resume the same intake;
  verify typed answers, follow-ups and movement/Back history survived.
- Restore connectivity: explicit upload completes. Interrupt and retry upload;
  confirm no duplicate server events and no local queue loss.
- New movement evidence after a prior negative requires fresh follow-up on both
  phone and server. Compare complete verdict/reasons, not just the verdict.
- Patient token cannot load doctor data; doctor can load the matching report;
  disconnect removes it. Expired token retains queued data for retry.
- Attempt another account/server: old assessment cannot be uploaded under it.
  Old-version assessment stays saved and requires a new assessment.

Clinical content remains draft until the supervisor/doctor reviews it. Successful
engineering tests do not validate clinical thresholds or diagnostic accuracy.
