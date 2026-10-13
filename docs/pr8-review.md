# PR8 and PR7 review — 2026-10-13

Draft, awaiting clinician review. Synthetic engineering tests only.

## Reviewed revisions

- PR8: `f6c560181653df251776b08207808d4ec505011c`, open, targeting
  `feature/A-gate`. Includes A's `d002a65` contract v1.2 / shoulder-2.
- PR7: `52a5486c6ab0f2f0174bdadb089a2a9dfa9a967e`, already merged via
  `e5d6d080b27175c2b5db1fd9767071871446630d`. GitHub still reports the same
  head; the old B branch no longer appears in remote branch lookup. There is
  no additional PR7 revision to integrate in this review.

## Decision

Keep PR8 and PR2 unmerged until the three findings below are fixed and CI passes.
Canonical and app-signal parity now pass, but four independent API/migration
regressions demonstrate cases outside those fixtures that incorrectly grant SAFE.
No review, approval, merge or teammate message was posted by the assistant.

## Reproduced findings for C

### 1. Invalid safety-answer IDs disappear at the adapter boundary

Priority: high. `server/app/store.py:148` combines canonical events with app
answers. `server/app/session_gate.py:203` filters canonical IDs and ignores
unmapped ordinary IDs. After a complete negative screen, POST /sync/answers
with `{questionId: 'typo_chest', type: 'yesno', state: 'answered', value: true}`
returns HTTP 200, answerValid=false, but gate SAFE with no fired rules.
This contradicts the endpoint's documented invalid-answer policy.

Validate the complete canonical event collection before mixing it with app
context. Either reject invalid events explicitly, or persist them while keeping
the gate blocked as documented; never silently filter them away. Do not require
all app/narrowing IDs to be canonical: those are a different input boundary.

### 2. Incomplete movement records are treated as negative evidence

Priority: high. `server/app/session_gate.py:77` checks only that each movement
is a dictionary. `{movementId: 'sideways_raise', state: 'done'}` gives SAFE
after the same baseline. So does a completed movement with weak=null and
unableToDo=null. Missing/null flags become falsey in signal derivation.

Validate movement fields before deriving signals. Incomplete/untrusted records
must be rejected or block clearance; missing is not false. Verify Boolean types,
completion state and the movement contract. Test through sync and report reads,
not only by calling the pure gate.

### 3. Legacy schema migration can revive an older negative answer

Priority: high for existing databases. `server/app/db.py:147` adds
answer_seq_before with default 0 to all legacy snapshots.
`server/app/store.py:156` then considers any answer sequence above 0 to be a
review after that evidence. Reproduction: complete negative answers, store an
unableToDo movement (CLARIFY), recreate the old schema without that column,
then call make_engine to migrate. The next GET /gate returns SAFE without a
new answer.

Use a conservative migration baseline or explicitly mark legacy reviews
unresolved. Do not infer historical order from a zero watermark. Preserve the
append-only data; require a new explicit follow-up when old order is unknown.

## Runnable regressions

After merging the latest A branch into C, run from the repository root:

```text
python -m pytest -q scripts/review_pr8_boundaries.py
```

All four tests fail on f6c5601 with the reported SAFE outputs. They cover an
unknown safety ID, two incomplete movement shapes, and legacy migration.
The required server CI job now runs this file when the API implementation exists.
Move/extend these into the server suite as desired, retaining their assertions.

## A-owned corrections made during this review

Seven conditional fixtures were missing per-case source and draft labels; their
source is now the software completeness contract, not a claim of clinical
validation. Stable danger-first ordering is restored. Inputs and expected
outputs are unchanged. A mobile regression checks both requirements so these
mistakes are caught even before the Python implementation is integrated.

CI now also triggers for pull requests targeting feature/A-gate. C must merge
this update into its branch so PR8 carries the workflow. The original required
jobs are retained; no failing tests or assertions were disabled.

## Verification evidence

- Unmodified PR8: 47/47 complete canonical outputs and 51/51 complete app-signal
  outputs match independently. Ruff passes.
- Unmodified PR8 full server suite: 2463 passed, 8 failed. All eight failures
  match the fixture source/label and ordering mistakes above.
- With only A's fixture correction applied in the isolated PR8 checkout:
  179 gate/provenance tests pass, followed by all 2471 existing server tests.
- A mobile gate/integrity tests: 71 pass. TypeScript passes. Full lint passes
  with 0 errors and 25 existing warnings.
- Four additional boundary regressions fail independently, despite the supplied
  parity suites passing. These are separate from the eight corrected failures.
- Local review uses Python 3.12 / Node 22.16; CI uses Python 3.11 and Node
  20 (Node 22 for SQLite). PostgreSQL and phone/API acceptance are not verified.

## Integration decisions still needed

The proposed 'latest context first, then flush answers' shortcut is not safe
for an existing offline backlog: older negative answers can arrive after newer
evidence and be mistaken for fresh follow-ups. Replay durable context and answer
events in their original order, or bind each answer to a server-checked context
revision. Do not wire the current answer-only outbox to that shortcut. This is
A/C integration work; the current phone does not yet upload context or answers.

Taha and Saud still need one agreed narrowing output/bank and side-specific
structure mapping. Matching the six movement IDs alone does not finish this.
Old shoulder-1 events remain preserved but blocked; migration/archive handling,
authenticated phone transport, device/airplane-mode tests and clinician review
remain pending.

Correction to C's review wording: persistent uncertainty still routes the phone
to /report/unclear, with the doctor action and movements blocked. Changing the
verdict name to CLARIFY does not remove that UI action. The doctor destination
is still a prototype, not a completed clinical referral service.
