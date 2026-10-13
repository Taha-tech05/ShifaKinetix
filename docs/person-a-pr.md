Broad onset and movement/sensory answers now request focused safety follow-ups instead of immediately forcing APP_REVIEW_* RED_FLAG. Explicit, saved clarification can permit narrowing; existing negatives cannot clear new evidence. Changed inputs invalidate the prior review. Confirmed clinical danger signs still stop.

Persistent uncertainty stays CLARIFY and routes to the unclear screen without movement clearance. Stop screens allow explicit correction, followed by a complete gate reevaluation. Shared gate-contract.md is v1.2 (content shoulder-2), with 47 full-output fixtures. Redness makes infection risk conditionally required: missing/unknown requests clarification, persistent unknown remains blocked, and a positive uses the existing combination rule. The fever_red_joint fixture gains a missing-risk reason. Clinical rule clauses are unchanged. Old assessments require a new intake; old outbox records are retained but need explicit version handling before sync.

The shoulder safety flow runs inside the team app using 20 sourced draft questions, 19 canonical rules, strict answer validation, persisted clarification and a conservative adapter for app safety signals. Incomplete or uncertain safety input cannot grant SAFE.

Includes Taha's PR #7 (52a5486) and its PR #6 lint fixes, preserving commits. Initial/fallback narrowing runs behind saved clearance; live submit/back awaits SQLite checkpoints. A's follow-up fixes premature danger redirects during a delayed save: previously verified same-selection assessments wait with protected content hidden, then re-evaluate. Reset, uncertainty and failed saves cannot grant clearance.

Safety answers and retry events persist transactionally. Explicit resume restores the assessment and recomputes the gate. Local context snapshots are not a complete server audit or sync implementation. Clinical material remains draft, awaiting clinician review.

Validation: 426 mobile tests and 15 real SQLite tests pass, along with TypeScript and lint (0 errors, 25 existing warnings). The earlier Android export passed; it was not repeated for this conditional-completeness change. Details are recorded in docs/person-a-verification.md. Follow-up tests exercise the real questionnaire, coordinator, gate and live driver; native IO/navigation are replaced in React tests. Separate real SQLite tests cover restart and save failures. Android export is not a device test.

**Draft - do not merge yet:**
- PR8 f6c5601 passes both parity suites (47 canonical, 51 app-signal cases). A's fixture metadata/order corrections remove the eight known test failures; all 2471 existing server tests pass in the isolated combined checkout.
- The three API/migration findings are fixed in PR9 (head c188c40), targeting C's branch. All 2484 local tests and both parity suites pass there. Review and merge PR9 into C, then verify PR8 before merging it here. Neither C nor its fix branch has been merged into this A branch yet.
- CI now runs on stacked PRs into feature/A-gate and checks those boundary regressions when the server API exists. No tests were weakened.
- Ordered context/answer sync, authenticated phone transport, final narrowing mapping, doctor-report integration, full audit, device acceptance and clinician review remain pending. See docs/person-a-handoff.md.

This review also passed 71 targeted mobile tests, TypeScript and lint. Preserve commits with normal merges after independent reviews and green checks.
