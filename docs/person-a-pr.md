Broad onset and movement/sensory answers now request focused safety follow-ups instead of immediately forcing APP_REVIEW_* RED_FLAG. Explicit, saved clarification can permit narrowing; existing negatives cannot clear new evidence. Changed inputs invalidate the prior review. Confirmed clinical danger signs still stop.

Persistent uncertainty stays CLARIFY and routes to the unclear screen without movement clearance. Stop screens allow explicit correction, followed by a complete gate reevaluation. Shared gate-contract.md is v1.1: only persistent_unknown changes its expected verdict among the 40 canonical fixtures. Clinical rule data is unchanged.

The shoulder safety flow runs inside the team app using 20 sourced draft questions, 19 canonical rules, strict answer validation, persisted clarification and a conservative adapter for app safety signals. Incomplete or uncertain safety input cannot grant SAFE.

Includes Taha's PR #7 (52a5486) and its PR #6 lint fixes, preserving commits. Initial/fallback narrowing runs behind saved clearance; live submit/back awaits SQLite checkpoints. A's follow-up fixes premature danger redirects during a delayed save: previously verified same-selection assessments wait with protected content hidden, then re-evaluate. Reset, uncertainty and failed saves cannot grant clearance.

Safety answers and retry events persist transactionally. Explicit resume restores the assessment and recomputes the gate. Local context snapshots are not a complete server audit or sync implementation. Clinical material remains draft, awaiting clinician review.

Validation: 416 mobile tests and 13 real SQLite tests pass, along with TypeScript, lint (25 existing warnings), and Android export. Details are recorded in docs/person-a-verification.md. Follow-up tests exercise the real questionnaire, coordinator, gate and live driver; native IO/navigation are replaced in React tests. Separate real SQLite tests cover restart and save failures. Android export is not a device test.

**Draft - do not merge while required checks fail:**
- C's Python placeholder fails all 40 parity fixtures with KeyError: when. Implement docs/gate-contract.md and independently review shared rules.
- C must adopt v1.1 and the focused-follow-up adapter policy beyond the 40 canonical cases. Local review metadata needs a context transport contract; the server must not trust client acknowledgments as authorization.
- Authenticated sync/doctor APIs, full live audit, device acceptance and clinician review remain pending; see docs/person-c-integration-request.md.

See docs/person-a-handoff.md and docs/safety-integration.md. Preserve commits with a normal merge after required independent reviews and green checks.
