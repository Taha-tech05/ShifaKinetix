# Shoulder gate contract v1.2

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
3. For each unconditionally or conditionally required safety question, in question order: missing becomes
   `CLARIFY` (`M_<id>`); unknown becomes `CLARIFY` (`U_<id>`); unknown after a
   clarification remains `CLARIFY` (`U_<id>`). The questionnaire routes persistent
   uncertainty to the unclear screen and withholds movements; uncertainty alone
   is not a positive clinical red flag. Users may explicitly review an answer.
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

## v1.1 integration change (2026-10-13)

Only the persistent_unknown canonical fixture changes verdict, from RED_FLAG to
CLARIFY. Rule matching and the 19 clinical rules are unchanged. A confirmed danger
still outranks uncertainty. C must match the updated complete outputs.

Broad app signals now request focused canonical follow-ups instead of forcing an
APP_REVIEW_* RED_FLAG. Explicitly saved follow-ups can resolve those signals;
old negatives cannot clear new evidence. See safety-integration.md for the local
acknowledgment contract. Raw context and review metadata require a separate server
transport contract; never trust a client acknowledgment as authorization.

## v1.2 conditional completeness (2026-10-13)

The shared content pair is now `shoulder-2`. There are 47 canonical fixtures.
`required: true` always requires an answer. Otherwise, a nonempty `requiredWhen`
list requires the question when ALL its clauses match valid, answered records
using strict equality. Missing or unknown trigger answers do not match. An empty
or absent list does not add a requirement. Evaluate completeness after clinical
rules and append M_/U_ reasons in question order, even when a clinical rule fires.

`infection_risk` remains optional unless `redness` is answered true. Then missing
risk gives M_infection_risk; unknown gives U_infection_risk and a fixed re-ask;
persistent unknown stays CLARIFY and routes to the unclear screen. An explicit
negative can allow SAFE only if the rest of the gate clears. A positive plus
redness fires the existing R_local_infection_risk. Redness alone adds no new
clinical RED_FLAG rule. This is draft software completeness policy, not a
validated diagnostic algorithm; the existing source and clinical-review label
remain attached to the question/rule.

Seven conditional fixtures supplement the original 40. fever_red_joint retains
RED_FLAG and gains M_infection_risk in its complete expected output. Both engines
must compare complete outputs, not verdicts alone. C must implement requiredWhen
as well as v1.1 uncertainty and the app follow-up contract.

Older saved intakes cannot be resumed under shoulder-2; start a new assessment.
Existing old-version outbox records are preserved, but the current client sync
stops at them rather than sending or silently deleting them. Explicit migration
or version-aware sync is still required with C. No automatic migration is claimed.
The shared version change requires A/C review before merge.
