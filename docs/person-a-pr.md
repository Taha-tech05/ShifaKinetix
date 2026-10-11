The shoulder safety flow now runs inside Taha's merged app (PRs #3?#5), replacing the runtime gate stub. It uses 20 sourced draft questions, 19 canonical rules, strict safety-answer validation, persisted clarification and a conservative adapter for app safety signals. Incomplete or uncertain safety input cannot grant SAFE.

Safety answers and retry events persist transactionally in SQLite. Explicit resume restores the same assessment and recomputes its gate; protected screens verify saved clearance before displaying movements. B's result, movement, live driver, theme and components remain unchanged; the store change is the agreed evaluator import only. Clinical material remains draft, awaiting clinician review.

Validation: 388 mobile tests and 11 actual SQLite tests; TypeScript and targeted safety lint pass. The combined Android Metro export passes (not an APK or phone test). Narrowing/UI unit tests inject a gate outcome; separate integration tests exercise the real gate/store/guard/live submit functions.

**Draft ? do not merge:**
- C's Python placeholder still fails all 40 parity fixtures (KeyError: when). Implement docs/gate-contract.md and review shared rules plus the app-signal adapter policy.
- Full lint has 75 errors in nine unchanged B-owned files. Keep lint enabled; see docs/person-a-handoff.md.
- B must move initial/fallback narrowing behind verified clearance and await safety checkpoints in the live submit/back flow. Current route checkpoints are not a complete durable live-event/audit pipeline.
- Server transport/doctor authorization, real-device airplane-mode acceptance, clinician review and administrator verification of protection remain pending.

See docs/safety-integration.md and docs/person-a-handoff.md for the exact interfaces and ownership handoffs. Preserve sequential commits with a normal merge after required independent reviews and green checks.
