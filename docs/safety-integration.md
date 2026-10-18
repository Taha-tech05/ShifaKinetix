# Safety integration into the team app

> **Contract v2 update (2026-10-18, branch feature/A-safety-triage).** Supersedes the focused follow-up
> table and the APP_REVIEW/alias sections below. The supervisor found three problems; each is fixed:
>
> 1. **Repeated safety questions.** The answer list is shared: onset is filled from "How did it start?" and
>    pain_score from the basics pain score, then shown as already answered. Narrowing no longer asks its own
>    tingling and numbness questions; it reads the safety answers (`narrowing/safetyFacts.ts`). Weak, painful
>    or skipped movements are never safety signals. Only a real contradiction asks again, once, worded as a
>    check: "During the movement checks you could not do one of the movements. Earlier you said you can move
>    this arm. Which is closer?" It comes after the whole movement set, never in the middle.
> 2. **Every Yes was an emergency.** Four care levels: Emergency (call 1122), Urgent (doctor today), Soon (doctor
>    in a few days: questions continue, movements skipped via `movementsBlocked`), Routine. Hard stops plus draft
>    weighted points; graded answers for pain, swelling and pins and needles. The safe and urgent screens show
>    the plain reasons. See [gate-contract.md](gate-contract.md) and [triage-scenarios.md](triage-scenarios.md).
> 3. **Questions not linked.** Two emergency questions, then one opening question per topic; details only when
>    the answer is Yes or Not sure. Low-risk path: 8 questions (6 to 7 with the basics reused) instead of 20.
>    A first "Not sure" on a hard-stop question shows its explanation on the same card instead of a re-ask screen.
>
> Verdicts keep their meaning for every consumer (only SAFE narrows). Gate output adds `level` and `score`;
> a SAFE output may list weighted signs. Server: same contract in `gate.py`/`session_gate.py`; ranking counts a
> denied topic as No; the condition table uses the new ids. Old shoulder-2 intakes need a new assessment.

> Current update (2026-10-13): ordered mobile context/answer sync, authenticated
> demo transport, doctor-report loading and live audit/history transport are now
> implemented and tested locally against the PR9 server (4 real-HTTP scenarios).
> Older statements below describing these as unimplemented are historical.
> Remaining: reviewed PR9/PR8 merges, deployment URL/account provisioning,
> B/C narrowing agreement, phone acceptance and clinician review. Current setup
> and evidence: [mobile-sync.md](mobile-sync.md) and [person-a-handoff.md](person-a-handoff.md).

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


Status: draft, awaiting clinician review. Demo only, not for real patients.

PRs #3, #4 and #5 are merged into develop. A merged develop at e4866e1 into
feature/A-gate, preserving B's shell, model assets, theme and components.
PR #7 (52a5486), including PR #6 lint fixes, is now integrated into A's branch.
B's guarded screens and durable live driver are preserved from those commits.
The session store has only the agreed evaluator-import substitution.

## Interfaces and clinical boundary

The UI's Answer accepts its existing template types and values. SafetyAnswer is
the strict yesno/choice/number/duration subset accepted by evaluate() and SQLite.
The canonical evaluator follows gate-contract.md v1.1. Of 40 fixtures, only
persistent_unknown changes verdict: CLARIFY instead of RED_FLAG; clearance remains blocked.
Unknown IDs, incorrect types, duplicate clinical answers and malformed values
still fail closed at that boundary. Ordinary UI questions are filtered by the
session adapter, never sent blindly to the canonical evaluator.

runGate() still returns a verdict and updates gateOutput and gateVerdict together.
Its import now resolves to gate/sessionEvaluator.ts. No runtime call uses the
old flagged-answer stub. The stub remains only for isolated narrowing/UI tests.

## Focused follow-ups (2026-10-13; supersedes APP_REVIEW overrides)

Broad positive or unknown app signals request a precise canonical question instead
of an automatic RED_FLAG. Until explicitly answered for the current evidence,
the adapter presents that canonical input as unknown, yielding CLARIFY. Existing
confirmed clinical positives remain positive and stop immediately.

| App signal | Canonical follow-up |
| --- | --- |
| Q_BASICS_HOW after_injury / suddenly | injury / sudden respectively |
| Q_BASICS_HOW unknown | injury, sudden |
| Q_ONSET_SUDDEN_TRAUMA without its basics answer | injury, sudden |
| Q_UNABLE_TO_MOVE_ARM | unable |
| Q_BONE_TENDER_AFTER_TRAUMA | injury |
| Q_NUMB_OR_WEAK | unable, numb, tingling |
| Q_ST_NUMB / Q_ST_TINGLE | numb / tingling respectively |
| Unknown movement | unable, numb, tingling |

The combined onset alias is redundant when its specific basics answer is present.
A failed single movement is not automatically inability to move the arm; movement
weakness is not automatically sensory loss. Help text distinguishes the existing
questions and explicitly explains correcting an earlier selection. Confirmed
injury/sudden onset still stops under the unchanged sourced rules. A low pain
score never cancels another positive warning sign. Optional context uncertainty
still does not block clearance.

Sources checked 2026-10-13: NHS shoulder-pain urgent advice and Leicestershire
Partnership NHS shoulder information (URLs in shared/clinical_sources.json).
The latter distinguishes common weakness/difficulty with movement from urgent
loss of movement. Neither source validates the software decision algorithm.
All follow-up choices, mappings and help text are draft, awaiting clinician review.

On saving a focused answer, SafetySession adds Q_SAFETY_REVIEW_<canonicalId> to
local context, type safety-review, value a serialized policy-2 evidence/answer
fingerprint. The original broad answer is retained. Fingerprints cover relevant
raw/derived signals and, for movement/sensory checks, movement context. An old
negative alone is insufficient. Changed evidence invalidates the acknowledgment;
toggling back cannot revive it. Starting a new intake removes review records.
SQLite resume restores the context but recomputes clearance. Failed context saves
cannot establish clearance. These metadata are not canonical answers or outbox
events; C needs equivalent server-owned evidence/clarification handling and a
context transport contract, not blind acceptance of client fingerprints.

Persistent canonical uncertainty stays CLARIFY, with its reason retained. The UI
routes it to /report/unclear. Resolving a CLARIFY escalation clears that escalation
only after the saved gate becomes SAFE. Confirmed danger stays RED_FLAG. Stop
screens offer explicit review/correction of matched questions; no review link
bypasses gate evaluation or permits movements on incomplete answers.

## Routes and persistence

- /report/danger: the 20 canonical questions, including choice and numeric inputs.
  Each answer is saved with its outbox event before progressing; matching clinical rules stop immediately.
  ?review=<questionId> explicitly reviews an answer, then reevaluates the complete intake.
- /report/reask: required uncertain questions, with persisted clarificationAttempted.
- /report/safe: verifies current saved answers again, then onSafe() hands off to
  routeAfterSafe(mode). Region/subregion and mode come from B's session store.
- /report/urgent and /report/unclear: stop screens; checkpoint current context
  when opened. They never grant clearance.
- SafeGuard: withholds protected children until current SQLite answers agree
  with session answers and the real evaluator confirms SAFE. Changed answer,
  movement or selection references invalidate that confirmation immediately.
  After a verified intake is edited, a null verdict for the same selection waits
  for a checkpoint with protected children hidden. Direct links, reset or changed
  selection cannot reuse that waiting state. Save failures return to danger.

gate/safetySession.ts coordinates the existing IntakeStore and session store.
intake_context adds a JSON snapshot for mode, selection, raw app answers,
movement results and clarification state. Verdicts are recomputed, never trusted
from disk. Checkpoints are serialized to prevent older writes overwriting newer
contexts. Clinical answers and their outbox events remain transactional.

Start new assessment explicitly discards previous clinical answers and movement
clearance. Resume saved assessment explicitly restores the same intake; a different
currently selected shoulder/subregion is rejected. A reset or changed selection
invalidates the active intake. Invalid/corrupt saved content fails closed.
After app restart, select the same shoulder and use Resume saved assessment on
the safety page. This resumes safety, not B's complete narrowing/history UI.

## B integration work: items 1 and 2 are done

1. Done. `report/movement.tsx` and `report/result.tsx` are now a thin screen that renders `SafeGuard`
   around a body component. `seedLiveState()` and the result fallback run inside the body, so they
   only run after the guard has confirmed the saved SAFE verdict.
2. Done. `flow/live.ts` has `submitMovementDurable`, `submitQuestionDurable` and `goBackDurable`.
   Each stores the answer, awaits `(await openSafetySession()).checkpoint()`, and only then runs
   the gate and the narrowing. If the save fails the outcome has `persistFailed: true`, `route:
   '/report/danger'` and no state, so nothing is narrowed from an unsaved answer. The live screen
   uses these and ignores further taps while one is being saved. The synchronous functions remain
   for tests and the dev seeder.

Still open:

1. Full live history/narrowing snapshots are still B's in-memory state. The safety
   context is not a complete persistent doctor audit log. Coordinate its server
   audit transport with C rather than assuming safety-context storage provides it.
2. Lint failures in B-owned files: fixed in PR #6. Keep lint enabled.

## Test boundaries

safetyIntegration.test.tsx uses the real evaluator, adapter, session store,
SafeGuard and live submit functions; only native persistence is mocked for React
guard tests. The Node SQLite suite runs actual persistence and SafetySession.
The four narrowing/UI suites inject a gate outcome to test B's presentation and
ranking behaviour independently; their injected SAFE is not evidence of clinical
clearance. No clinical-positive fixture is skipped or weakened; persistent_unknown changes
classification as documented in v1.1 and still cannot grant SAFE.

Native phone/airplane-mode acceptance, clinician approval, server sync and server
signal parity remain pending. An Android Metro export is not an APK or device test.
