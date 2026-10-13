The team app now runs the real draft shoulder safety gate before narrowing or movement checks. Broad onset/sensory/movement signals request focused follow-ups; confirmed danger stops, and unresolved uncertainty remains CLARIFY. Fresh evidence invalidates older review. Includes 20 sourced questions, 19 rules, 47 canonical fixtures and 51 app-signal parity cases; all clinical content remains **draft, awaiting clinician review**.

Safety answers and context persist to SQLite before clearance. Explicit resume restores the assessment and reevaluates it. Ordered context/answer uploads preserve the chronology of evidence and follow-ups, retry with stable keys, validate durable acknowledgements and bind each assessment to its account/server. Old content and legacy answer-only queues are retained and require a new assessment, without inventing history.

A's safety screens now include a saved-assessment panel with authenticated demo connection and server-authorized doctor reports. Canonical answers, raw app/movement evidence, live answer/Back history, narrowing snapshots and gate audit records are transported. Local review tokens cannot authorize server clearance. Tokens stay in memory; patient accounts cannot request the differential. This uses C's reviewed API and does not replace production sign-in or reconcile B/C's separate narrowing banks.

Includes Taha's PR7 (52a5486), PR6 lint fixes and A's delayed-save guard correction. B-owned result/movement screens, live driver, theme and store remain unchanged by the sync addition.

Validation: **450 mobile tests, 20 real SQLite tests and 4 real HTTP integration scenarios pass**. TypeScript, lint (0 errors, 25 existing warnings), and Android export pass. HTTP tests use the actual mobile coordinator/SQLite and an isolated PR9 server at c188c40 with fictional accounts. They cover restart, new evidence, fresh follow-ups, lost acknowledgement, uncertainty/danger, doctor authorization and live audit history. Physical-phone and hosted-server acceptance are still pending.

**Draft ? integration still required:**

- Review/merge PR9 into C, then updated PR8 into this branch, then verify combined PR2. PR9 fixed malformed-answer/movement boundaries and legacy review chronology; all five PR9 CI jobs passed, including PostgreSQL. Those server changes are not yet in this A branch, so existing server/parity checks still target the placeholder.
- The offline-storage CI job runs the new real-HTTP integration tests when C's API is present; a conditional skip is not an integration pass.
- Saud must supply the demo API URL and account provisioning. B/C must reconcile final narrowing output/model mapping. Team phone acceptance and supervisor/doctor review remain pending.

Setup and precise limits: docs/mobile-sync.md. Current owner handoff: docs/person-a-handoff.md. Preserve commits with normal merges after independent review and green checks.
