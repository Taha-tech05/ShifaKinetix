# Clinical and engineering review log

Status: draft, awaiting clinician review. Demo only, not for real patients.

| Date | Reviewer role | Artifact | Result | Follow-up |
|---|---|---|---|---|
| 2026-10-10 | Zaid / implementation self-check | Shoulder draft and source inventory | Prepared for review; not clinical approval | Review by C and human clinicians pending |
| Pending | Faculty supervisor | One-page shoulder summary | Not yet reviewed | Record comments and decisions |
| Pending | Doctor | Questions and rules | Not yet reviewed | Record clinical scope, urgency and wording decisions |
| Pending | Saud (C) | Shared v1 rules and parity | Not yet approved | Implement Python contract, pass parity, approve PR |
| 2026-10-18 | Faculty supervisor (relayed by teammate) | Live demo of the safety check, shoulder-2 | Three findings: safety questions repeated mid-flow; any single Yes treated as critical; no weighting or linking | Contract v2 on feature/A-safety-triage; supervisor to review docs/triage-scenarios.md |
| Pending | Faculty supervisor / doctor | Draft points, thresholds and grouped wording (shoulder-3) | Not yet reviewed | Mark each scenario row OK or the right level; adjust shared/gate_rules.json |
| 2026-10-19 | Taha (B) | Contract v2 (PR #13) | Merged into develop by Taha (3ae4600) | Saud's (C) review of the gate/server changes still to be recorded, as the shared-rule rule requires |
| Pending | Saud (C) | Contract v2.1 unresolved answers and team-rule wording (shoulder-4) | Not yet reviewed | Approve "never Routine / never movements" wording; review gate.py change |

For each review add: date, role (name optional), content version/commit,
question/rule ID, finding, proposed change, source, disposition, owner and
verification evidence. Keep previous findings; append corrections instead
of inventing approvals or overwriting the history. A medical student review,
if later used, must be described accurately as such.
