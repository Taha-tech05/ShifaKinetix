# Person A implementation and review plan

Owner: Zaid (A). Scope: shoulder-only mid-term prototype.
Status: draft, awaiting clinician review. Demo only, not for real patients.

Start point: PR #1 merged into develop at 27455cb. Work lives on
feature/A-gate; never push directly to develop or main. Preserve small commits
with a normal merge, without Co-authored-by trailers.

## Integration update (2026-10-12)

PRs #3?#5 are merged. A has merged develop into feature/A-gate and replaced the
runtime gate stub in the team app. See person-a-handoff.md for current results
and safety-integration.md for the adapter, SQLite and remaining B/C work.
The original standalone-demo delivery below records the first implementation;
it is no longer the current app entry flow.

PR #7 and its PR #6 lint fixes are now integrated, with a delayed-save guard fix.
Current validation: 403 mobile tests, 11 SQLite tests, typecheck, full lint
(0 errors, 25 warnings), and Android export pass. Python parity remains blocked
by C's placeholder. See person-c-integration-request.md for backend dependencies.

## Delivery sequence

1. Document scope, sources, and shared gate contract.
2. Add sourced shoulder questions and deterministic rules.
3. Implement the TypeScript evaluator and shared danger-first fixtures.
4. Implement SQLite answer persistence, content cache, and retry queue.
5. Add questionnaire and doctor report components for B's mobile shell.
6. Strengthen CI, prepare review records and demo instructions.

## Ownership and integration

- A owns the clinical draft data, TypeScript gate, offline storage, question UI,
  doctor report presentation, test fixtures, and CI.
- B owns the viewer, app navigation/shell, animations, camera, localization and APK.
- C owns the Python evaluator, authenticated doctor API, ranking and backend.
- A provides a standalone safety-demo entry using Expo Router. B can integrate
  those screens into the production shell without replacing the viewer.
- Shared v1 fixtures are a contract for C. Do not weaken them to make the
  placeholder Python evaluator pass. A failing parity check blocks merging.
- Gate-rule changes require A and C review. A cannot approve their own PR;
  record A's authorship/self-check and obtain C's independent approval, plus
  whatever additional approval the repository requires.

## Human checks

- A faculty supervisor and a doctor are available to review the summary (confirmed by Zaid);
  names are intentionally not recorded. Availability is not approval.
- Real-device airplane-mode testing and clinician review must be recorded only
  after they actually happen.
- Branch protection requires repository settings access. Workflow files alone
  cannot establish it. No direct messages or invitations are sent by this task.

## Source boundaries

Use only the allocation's named sources: Finucane 2020, StatPearls, NICE CKS,
and NHS. This is a curated questionnaire, not a downloaded patient dataset.
Finucane addresses spinal pathology, not a validated shoulder screening score.
NICE CKS was inaccessible during source checking on 2026-10-10; no rule is
attributed to unverified NICE text. Exact questionnaire wording and escalation
policy are draft adaptations, not validated diagnostic criteria.
