The shoulder safety flow runs inside the team app using 20 sourced draft questions, 19 canonical rules, strict answer validation, persisted clarification and a conservative adapter for app safety signals. Incomplete or uncertain safety input cannot grant SAFE.

Includes Taha's PR #7 (52a5486) and its PR #6 lint fixes, preserving commits. Initial/fallback narrowing runs behind saved clearance; live submit/back awaits SQLite checkpoints. A's follow-up fixes premature danger redirects during a delayed save: previously verified same-selection assessments wait with protected content hidden, then re-evaluate. Reset, uncertainty and failed saves cannot grant clearance.

Safety answers and retry events persist transactionally. Explicit resume restores the assessment and recomputes the gate. Local context snapshots are not a complete server audit or sync implementation. Clinical material remains draft, awaiting clinician review.

Validation: all 403 mobile tests, 11 actual SQLite tests, TypeScript and full lint pass (0 errors, 25 warnings). Android Metro export passes, not an APK/device test. Four additional real-screen/guard tests cover delayed saves, uncertainty, failure and reset.

**Draft - do not merge while required checks fail:**
- C's Python placeholder fails all 40 parity fixtures with KeyError: when. Implement docs/gate-contract.md and independently review shared rules.
- Full app-input consistency also requires server handling and tests for app-signal adapter policy beyond the 40 canonical cases.
- Authenticated sync/doctor APIs, full live audit, device acceptance and clinician review remain pending; see docs/person-c-integration-request.md.

See docs/person-a-handoff.md and docs/safety-integration.md. Preserve commits with a normal merge after required independent reviews and green checks.
