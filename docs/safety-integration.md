# Safety integration into the team app

Status: draft, awaiting clinician review. Demo only, not for real patients.

PRs #3, #4 and #5 are merged into develop. A merged develop at e4866e1 into
feature/A-gate, preserving B's shell, model assets, theme and components.
B's report/result.tsx, report/movement.tsx and flow/live.ts are unchanged.
The session store has only the agreed evaluator-import substitution.

## Interfaces and clinical boundary

The UI's Answer accepts its existing template types and values. SafetyAnswer is
the strict yesno/choice/number/duration subset accepted by evaluate() and SQLite.
The canonical evaluator and its 40 complete-output fixtures retain their contract.
Unknown IDs, incorrect types, duplicate clinical answers and malformed values
still fail closed at that boundary. Ordinary UI questions are filtered by the
session adapter, never sent blindly to the canonical evaluator.

runGate() still returns a verdict and updates gateOutput and gateVerdict together.
Its import now resolves to gate/sessionEvaluator.ts. No runtime call uses the
old flagged-answer stub. The stub remains only for isolated narrowing/UI tests.

The adapter preserves positive onset, movement-inability, bone-after-trauma,
sensory and weakness signals as separate APP_REVIEW_* reasons. It does NOT
invent an answer such as “numb = true” from a weak movement. These are conservative
draft stop policies, not diagnostic equivalences or validated clinical rules.
Reference: https://www.nhs.uk/symptoms/shoulder-pain/ (urgent-advice section).
The broader movement/weakness policy is an engineering precaution requiring
clinician review; the NHS page does not validate B's derived-question definitions.

Unknown app safety signals request the relevant canonical clarification:

| App signal | Canonical clarification |
| --- | --- |
| Q_ONSET_SUDDEN_TRAUMA | injury, sudden |
| Q_UNABLE_TO_MOVE_ARM | unable |
| Q_BONE_TENDER_AFTER_TRAUMA | injury |
| Q_NUMB_OR_WEAK / Q_ST_NUMB | numb |
| Q_ST_TINGLE | tingling |
| Unknown movement | unable, numb |

Derived negatives never grant clearance. An unresolved original app signal is
not erased by a different negative answer: after clarification it still requires
clinical review. Ordinary canonical uncertainty can resolve with a valid answer;
repeated uncertainty becomes RED_FLAG. The questionnaire presents an uncertainty-only
stop at /report/unclear. Positive signals take priority over incomplete answers.
This mapping and APP_REVIEW_* policy need A/C and clinician review. C must account
for equivalent app signals on the server; canonical parity alone does not test them.

## Routes and persistence

- /report/danger: the 20 canonical questions, including choice and numeric inputs.
  Each answer is saved with its outbox event before progressing; positives stop immediately.
- /report/reask: required uncertain questions, with persisted clarificationAttempted.
- /report/safe: verifies current saved answers again, then onSafe() hands off to
  routeAfterSafe(mode). Region/subregion and mode come from B's session store.
- /report/urgent and /report/unclear: stop screens; checkpoint current context
  when opened. They never grant clearance.
- SafeGuard: withholds protected children until current SQLite answers agree
  with session answers and the real evaluator confirms SAFE. Changed answer,
  movement or selection references invalidate that confirmation immediately.

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

## Remaining B integration work (owned files intentionally unchanged)

1. flow/live.ts seedLiveState() and the fallback in report/result.tsx currently
   calculate narrowing before their enclosing SafeGuard renders. Move those calls
   behind verified SAFE clearance; a child guard cannot prevent a parent's computation.
2. The live submit/back API is synchronous. Await
   `(await openSafetySession()).checkpoint()` after changing an answer/movement and
   before advancing/narrowing; handle persistence failure by stopping. Current
   SafeGuard/stop-route checkpoints do not make that entire synchronous operation
   durable. A forced kill before the checkpoint can lose the newest live event.
   B should coordinate an async entry point in flow/live.ts and its movement callers.
3. Full live history/narrowing snapshots are still B's in-memory state. The safety
   context is not a complete persistent doctor audit log. Coordinate its server
   audit transport with C rather than assuming safety-context storage provides it.
4. Fix lint failures in B-owned files listed in person-a-handoff.md. Keep lint enabled.

## Test boundaries

safetyIntegration.test.tsx uses the real evaluator, adapter, session store,
SafeGuard and live submit functions; only native persistence is mocked for React
guard tests. The Node SQLite suite runs actual persistence and SafetySession.
The four narrowing/UI suites inject a gate outcome to test B's presentation and
ranking behaviour independently; their injected SAFE is not evidence of clinical
clearance. No shared gate fixture is skipped or weakened.

Native phone/airplane-mode acceptance, clinician approval, server sync and server
signal parity remain pending. An Android Metro export is not an APK or device test.
