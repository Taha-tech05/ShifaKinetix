# Panel Action Register

Status: draft, awaiting clinician review. These are implementation follow-ups,
not invented findings from a panel meeting. Add actual panel feedback verbatim
with its date when available.

| ID | Action | Owner | Status / acceptance evidence |
|---|---|---|---|
| A01 | Source shoulder questions and rules | A | Draft implemented; human review pending |
| A02 | Prevent incomplete/unknown answers from clearing | A | TypeScript shared and integrity tests pass |
| A03 | Retain typed answers and offline gate | A | Real SQLite automated tests pass; device airplane test pending |
| A04 | Cross-language output parity | C implements, A verifies | Blocked: placeholder Python evaluator rejects v1 rules |
| A05 | Enforce doctor-only report access | C server, B shell, A presentation | A component ready; authenticated server integration pending |
| A06 | Clinical review | A coordinates | Faculty supervisor and doctor available; summary prepared; not yet reviewed |
| A07 | Protect develop and main | Repository administrator (Taha) | Zaid has push access, not admin; settings require administrator |
| A08 | APK / real-device offline test | B builds, A tests | Pending real device; record device/build/result |
| A09 | Integrate question screens after confirmed shoulder selection | B with A | Standalone safety demo ready for integration |
| A10 | Connect durable outbox transport | C with A | Queue implemented; server authentication/idempotency contract pending |
| A11 | Review dependency audit findings | B / team | npm reports inherited/transitive findings; no forced upgrades applied |
