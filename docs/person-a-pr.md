Shoulder intake previously contained placeholder questions and a gate that
could clear incomplete input. This change adds 20 sourced draft questions,
19 rules, strict typed-answer validation, and clarification/referral handling.
Missing required answers cannot be SAFE. A second uncertain safety response
routes to clinical review.

Answers, clarification state, content and pending updates persist in SQLite.
The gate re-evaluates saved answers without network access. Question screens
run in an Expo Router demo; the doctor report component has no patient route
and awaits an authenticated server loader. Clinical review materials and
integration instructions are included. All clinical content remains draft,
awaiting clinician review; use fictional data only.

Validation: 67 TypeScript tests, 8 real SQLite tests, 80 Python source/health
checks, lint, typecheck and Android bundle export passed locally. CI adds real
SQLite testing and complete output comparison between both gate evaluators.

**Draft / do not merge:** C's existing Python evaluator does not implement the
new shared contract: all 40 parity cases currently fail. C must implement
`docs/gate-contract.md` and approve the rule changes; do not skip or weaken
these tests. B must integrate the screens and authorized doctor flow into the
shell. Server sync, real-device airplane-mode testing, clinician review and
administrator verification of branch protection remain pending.

Zaid has push access but cannot administer branch protection. No server
implementation files were changed. Preserve the sequential commits with a
normal merge after the required independent reviews and green checks.
