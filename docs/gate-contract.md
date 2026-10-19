# Shoulder gate contract v2.1

Status: draft, awaiting clinician review. Demo only, not for real patients.

v2.1 (content `shoulder-4`, 2026-10-19) adds simpler questions and unresolved answers (see below).
v2 (content `shoulder-3`, 2026-10-18) answered the supervisor's review: safety questions were repeated in the
middle of the flow, any single Yes was an emergency, and every patient got the same 20 questions. Sections
below "History" describe v1.0 to v1.2 and are kept for the record. Their counts and rule ids are superseded.

`shared/questions_shoulder.json` and `shared/gate_rules.json` are a versioned pair (schemaVersion 2). A clinical
source supports the symptom being screened; it does not validate this software policy, the points or the
thresholds. Both evaluators (`mobile/src/gate/evaluate.ts`, `server/app/gate.py`) implement this contract
independently and must give the same complete output on every shared case.

## Linked questions

Each question has a `tier`:

| Tier | Meaning | "Not sure" |
| --- | --- | --- |
| `hardStop` | Can stop the flow on its own (chest, breathing, unable, shape, numb, tingling, temperature, swelling, infection_risk) | Asks its simpler question (`fallback`); still "Not sure" makes it **unresolved** (see below) |
| `gateway` | One opening question per topic (sensation, inflammation, illness) | Opens the topic's detail questions; never blocks by itself |
| `weighted` | Adds points (onset, redness, fever, systemic, cancer, pain_score, bilateral) | Counts half of the question's largest points; never blocks by itself |
| `context` | duration, side | Never asked by the safety check; never changes the result |

A question is **asked** when `required` is true, or when ANY clause of its `askWhen` matches an answered record
(`equals`, `in`, or `atLeast` with an optional `below`). `orUnknown: true` also matches a "Not sure" to that
question, so uncertainty opens details instead of skipping them. Bank order is the asking order; a linked
question waits until a question that opens it has been answered.

The eight always-asked questions are chest, breathing, onset, unable, sensation, inflammation, illness and
pain_score. `prefillFrom` names an earlier app answer that already answers a question (onset from
`Q_BASICS_HOW`, pain_score from `Q_BASICS_PAIN_NOW`). The questionnaire saves it from there as a normal
canonical answer with its outbox event, and shows it as already answered. The patient can still change it.

`deniedValue` is what an unasked detail question counts as when every answer that would open it was given and
none opened it (a gateway No, or a gradual onset for "changed shape"). Only doctor-side ranking and the app's
narrowing use it; the gate never needs it, because an unasked question fires nothing.

## Simpler questions and unresolved answers (v2.1)

Every hard-stop question has a `fallback`: a simpler, concrete question about something the patient can notice
(for example "Can you lift your hand up to your mouth, even if it hurts?"), whose options give the canonical value.
A first "Not sure" shows it on the same card. An answer saves the canonical value. "Not sure" again saves the
canonical question as unknown with `clarificationAttempted: true`: it is **unresolved**.

`unresolved` in the rule file sets how many may stay open (`allowed`: 1) and the lowest level they allow
(`level`: SOON). Up to `allowed` unresolved answers, none of them chest or breathing, do not stop the check: each
is listed as `N_<id>` ("Could not check ... in the app", 0 points) and the result is at least SOON (see a doctor in
the next few days; no movements). Chest or breathing unresolved, or more than `allowed`, gives `U_<id>` with the
"Uncertainty persists" reason for each: CLARIFY, the unclear screen. Unresolved answers add no points, so another
answer can never lower a result. The team rule "Not sure on a key danger question never gives SAFE" becomes
"never gives ROUTINE and never allows movements" (A and C to confirm).

## Rules and care levels

Rules keep their `all` list of clauses, matched against any valid answered record (asked or not). Each rule has
exactly one of:

- `level`: a **hard stop**, `EMERGENCY` (chest, breathing) or `URGENT` (cannot move the arm, changed shape, no
  feeling, pins and needles that do not go away, a cold arm, bad swelling, fever with a red joint, infection risk
  with a red joint). Points never lower a hard stop.
- `points`: a **weighted sign**. Single clause only. Draft values: injury start, sudden start, very bad pain
  (8 to 10), hot to touch, fever, both shoulders, weight loss or night sweats, past cancer: 2 each. Strong pain
  (6 or 7), redness, pins and needles that come and go, a little swelling: 1 each.

`levels` in the rule file holds the thresholds: score at or above `SOON` (2) is SOON, at or above `URGENT` (4)
is URGENT. With these values every single sign on the NHS shoulder-pain urgent list is at least SOON on its
own, and any two of them are URGENT. The NHS page itself grades "see a GP" and "urgent GP or 111"; the
weighting is our software policy and needs clinician sign-off. See [triage-scenarios.md](triage-scenarios.md).

## Order of evaluation and output

1. Malformed input, duplicate or unknown ids, wrong types or values: `RED_FLAG`, level `URGENT`, rule `INPUT_INVALID`.
2. Rules in file order: hard stops record their level, weighted signs add points.
3. Each uncertain weighted answer adds `W_<id>` at half points, in question order.
4. Each asked question, in question order: missing gives `M_<id>`; "Not sure" on a hard-stop question gives
   `U_<id>` (reason states whether the clarification was already attempted).
5. Verdict and level: a hard stop or score >= URGENT gives `RED_FLAG` with the highest level; otherwise any
   M_/U_ gives `CLARIFY` with level `null`; otherwise `SAFE` with level `SOON` or `ROUTINE`.

Output: `{verdict, level, score, firedRules: [{ruleId, matchedAnswers, source, reason, level? | points?}]}`.
A SAFE result may list weighted signs (each with points) and nothing else. Verdicts keep their v1 meaning for
every consumer: only SAFE permits narrowing; RED_FLAG and CLARIFY never do.

**SOON means: see a doctor in the next few days. Questions continue, the physical movement checks are skipped.**
ROUTINE is the full flow. SAFE at either level is only "no draft stop applies"; it is not a diagnosis.

## Follow-ups (session gate)

The session gate (`sessionAdapter.ts`, `session_gate.py`) asks again only for a **contradiction** with an answer
the patient gave, and adds `F_<id>`; a pending follow-up turns SAFE into CLARIFY and is listed beside danger:

- a basics answer (`prefillFrom`) that now differs from the saved canonical answer;
- unable = No, and after the whole set of six movements at least one answered movement could not be done.

Weak, painful, skipped or unknown movements, and the narrowing questions, are never safety signals. A
follow-up answered for the current evidence clears it (mobile: review token; server: answer received after the
evidence). New evidence needs a new answer.

## Safety properties (tested on both platforms)

- A more worrying answer never lowers the care level (ROUTINE < SOON < CLARIFY < URGENT < EMERGENCY).
- "Not sure" never gives a lower care level than the least worrying answer.
- A hard stop always wins over the points total.
- Every path the questionnaire can take to SAFE has answered or explicitly closed every hard-stop question.
- 55 canonical and 22 app-signal fixtures give identical complete outputs in TypeScript and Python; a second
  hand-written restatement of the contract matches 3000 random intakes.

## Content version

Older intakes (shoulder-2, shoulder-3) need a new assessment under shoulder-4; shoulder-2 answers fail closed
(`INPUT_INVALID`), and the server refuses events for another content version. Their
outbox records stay on the device, unsent and undeleted, as before. The rule change needs A and C review.

## History (v1.0 to v1.2)


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
