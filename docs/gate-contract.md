# Shoulder gate contract v1

Status: draft, awaiting clinician review. Demo only, not for real patients.

`shared/questions_shoulder.json` and `shared/gate_rules.json` are a versioned
pair. A clinical source supports the symptom being screened; it does not
validate this software policy. This document is the source for software-only
completeness, integrity and uncertainty handling.

## Inputs

Answers retain `{questionId, type, value, state}`. Types are `yesno`, `choice`,
`number`, `duration`. `unknown` always has a null value. Answered yes/no values
are real JSON booleans, never strings or 0/1. Duration is a non-negative number
of days; number is a finite value in the question's bounds. Choice is one of
the declared option values. Optional `clarificationAttempted: true` records
that the fixed clarification was shown and answered. It is persisted locally.

The caller supplies the complete saved answers for one intake, not just the
latest answer. Never mix intakes or accept an LLM-generated answer as consent.

## Order of evaluation

1. Reject malformed records, duplicate IDs, unknown IDs, wrong types, invalid
   values and inconsistent states with `RED_FLAG`, rule `INPUT_INVALID`.
2. Evaluate all clinical rules, each an `all` list of exact equality clauses.
   A clause matches only a valid `answered` record. Preserve JSON rule order.
3. For each required safety question, in question order: missing becomes
   `CLARIFY` (`M_<id>`); unknown becomes `CLARIFY` (`U_<id>`); unknown after a
   clarification becomes `RED_FLAG` (`U_<id>`). These are conservative routing
   policies, not evidence that a disease is present.
4. Priority is `RED_FLAG`, then `CLARIFY`, then `SAFE`. Only a complete, valid
   safety screen without a match can be SAFE. Optional context unknowns do not
   create clearance or imply negative clinical answers.

`SAFE` means only that no draft gate rule fired. It is not a diagnosis or
assurance of safety. Neither CLARIFY nor RED_FLAG permits movements or AI.
Run again after every save and immediately before any downstream response.
Do not reuse a previous intake's SAFE result for follow-up symptoms.

## Output and parity

`{verdict, firedRules: [{ruleId, matchedAnswers, source, reason}]}`.
`matchedAnswers` contains question IDs in clause/question order; synthetic
missing-question rules name the missing ID. Integrity failure uses an empty
list. The reason is the rule description; synthetic reasons are fixed strings
defined in the TypeScript evaluator and asserted by shared fixtures.

Shared fixtures contain full expected outputs, danger cases first. C must
implement this contract independently in Python; the parity job compares the
entire output, including reasons, sources and rule order. Do not enable a
patient-facing flow until both implementations pass.

## Source provenance

`shared/clinical_sources.json` lists URLs, scope, retrieval date and limitations.
Each question and rule has a direct source URL and draft label. Validation
bounds for user-interface numbers are input constraints, not medical cutoffs.
Finucane is background for cautious assessment only. No LLM or invented
dataset is used to generate runtime safety questions.
