# Saud: requirements for Person A integration

## Ready fix PR9 ? supersedes the implementation requests below

A implemented the three findings with the user's authorization. Review
https://github.com/Taha-tech05/ShifaKinetix/pull/9 (base feature/C-server, head
c188c40) and merge normally after CI passes. All 2484 local tests and both parity
suites pass. No reimplementation needed. The existing PR8 then receives these
changes. Ordered offline transport and final narrowing integration remain open.


## Latest review action ? PR8 f6c5601

The current review is [pr8-review.md](pr8-review.md); it supersedes the older
placeholder/failed-parity status below. Both parity suites pass. A fixed the
fixture source/label and ordering issues; all 2471 existing server tests then
pass. Four new boundary tests fail on three issues. Merge the latest A branch,
fix those in the same PR8, and run `python -m pytest -q
scripts/review_pr8_boundaries.py` from the root along with both parity scripts,
full server tests and CI. CI now supports the stacked base feature/A-gate.

Do not use 'latest context first, then old answers' for offline replay: preserve
original event order or bind reviews to a checked context revision. This remains
joint A/C integration work, not completed transport. Keep PR8/PR2 on merge hold.


## Conditional infection-risk update (contract v1.2)

Current shared content is `shoulder-2`, with 47 full-output fixtures. Redness=true
makes infection_risk conditionally required through shared `requiredWhen` data.
Missing/unknown risk gives CLARIFY; repeated unknown stays CLARIFY and routes to
unclear. Explicit risk=false may clear if all other checks pass; risk=true with
redness uses the existing RED_FLAG rule. This supersedes earlier counts/version
references below; v1.1 focused-follow-up behavior remains in force.

Saud: continue updating the SAME PR #8; merge the latest feature/A-gate after this
change is pushed, implement conditional completeness in Python, and run all 47
full-output fixtures plus app/movement parity. The fever_red_joint fixture also
now includes M_infection_risk. Do not revert the focused-follow-up work.
PR #8 and PR #2 remain on merge hold pending parity, checks and independent review.
The shared rules contentVersion changed, so A/C review is required before merge.

Start a new intake for shoulder-2. Old assessments/outbox records are retained;
old-version sync currently stops and requires explicit version handling with C.
Clinical content remains draft, awaiting clinician review.


Status: draft, awaiting clinician review. Current integration: feature/A-gate,
including Taha's PR #7 and its PR #6 lint fixes. Do not replace current shared
contracts with the original develop placeholders. Preserve existing C work.

## New contract update, 2026-10-13

Use gate-contract.md v1.1: persistent uncertainty remains CLARIFY, not RED_FLAG;
movements remain blocked. One of the 40 canonical expected outputs changed.
APP_REVIEW_* automatic overrides have been replaced by focused follow-ups. A
new positive/unknown app signal invalidates an older negative answer until the
precise safety question is answered again. The local app preserves raw signals
and context-bound review records. Implement equivalent server-owned resolution;
do not trust client review tokens. These records are not yet in the answer outbox.
See safety-integration.md and safetyQuestionnaire.test.tsx for paths and examples.

## Immediate merge blockers

1. Implement the independent Python gate in server/app/gate.py using
   docs/gate-contract.md and the current shared questions/rules. The placeholder
   reads `when`; the current rules use `all`. Current parity run fails all 40
   cases with KeyError: when. Match complete outputs, including reason, source,
   matchedAnswers and ordering, not just verdicts. Preserve missing/unknown,
   clarificationAttempted, strict input validation and RED_FLAG > CLARIFY > SAFE.
   Do not downgrade the data or weaken fixtures to make the placeholder pass.
2. Run `python scripts/check_gate_parity.py` from the repo root and `ruff check .`
   plus `pytest -q` from server. Share the PR and results. Shared rules require
   C's independent review in addition to A's authorship/self-check; keep clinical
   labels draft, awaiting clinician review and retain source provenance.
3. Agree equivalent handling of broader app signals in gate/sessionAdapter.ts,
   gate/sessionEvaluator.ts and docs/safety-integration.md. Canonical 40-case
   parity does not cover movement uncertainty or the focused-follow-up adapter policy.
   Preserve positive trauma, inability and sensory/weakness signals, and unknown
   movement responses. Never turn unknown into false. Add agreed cross-platform
   fixtures for these policies; do not imply they are clinician-approved.

## API contracts needed to finish A's integration

### Offline answer sync

The implemented `IntakeStore.sync(send)` supplies events shaped as:

```ts
{
  idempotencyKey: string,
  intakeId: string,
  contentVersion: string,
  answer: {questionId, type, value, state, clarificationAttempted?}
}
```

Provide method/path, authentication and intake ownership rules, request/response
examples, durable acknowledgment, error responses and content-version policy.
Deduplicate repeated idempotencyKey values, including a retry after a lost response.
The client removes an event only after send resolves successfully; failed events
remain queued. The server must assemble the intake's answers before evaluating,
not evaluate an isolated event as if it were a complete assessment.

The current outbox contains canonical safety-answer events. Raw app answers and
movement results have a local context snapshot, not an upload event stream.
Agree movement/context sync and append-only audit contracts with A and B; a local
snapshot is not a complete clinical audit/history log.

### Server safety enforcement and doctor report

Recompute safety on the server before narrowing/ranking/agent processing. Do not
trust a submitted client SAFE verdict; RED_FLAG/CLARIFY must block downstream work.
Coordinate narrowing API inputs/outputs with Taha; that logic remains C's scope.

Provide an authenticated doctor-only endpoint matching or explicitly mapping to
mobile/src/reports/doctorReport.ts:

```ts
{
  audience: 'doctor',
  label: 'draft, awaiting clinician review',
  intakeId: string,
  facts: {label: string, value: string}[],
  gate: GateOutput,
  differential: {condition: string, reason: string, source: string}[]
}
```

Enforce identity, doctor role and assessment access on the server. Supply 401/403
behavior and tests that patient/anonymous requests cannot obtain the differential.
A's presentation role check is not backend authorization. Provide the auth/session
contract and development URL; keep credentials outside commits and group messages.

Agree audit events retaining answer changes, clarification, gate/rule versions,
sources and timestamps. Full live history persistence needs A/B/C coordination.

## Delivery and branch coordination

Send existing C branch/PR and progress first so completed work is not duplicated.
If develop still lacks A's contracts, integrate updated feature/A-gate into C's
branch and use a stacked PR targeting feature/A-gate for the gate dependency,
or coordinate another explicit base. Do not push directly to develop/main.
Keep small commits, independent review and required checks.

Priority: Python parity and rule review unblock the current PR; app-signal parity
is needed for the full consistency claim; sync and doctor API contracts unblock
A's remaining backend integration. Report what is implemented versus only agreed.
