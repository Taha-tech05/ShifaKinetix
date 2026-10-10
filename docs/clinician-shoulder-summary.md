# Shoulder safety screen: one-page review brief

**Draft, awaiting clinician review. Demo only, not for real patients.**

Reviewers available: faculty supervisor and a doctor (names omitted at Zaid's
request). Review date, findings and sign-off are **pending**.

**Purpose.** A fixed shoulder screen precedes all movement checks and AI.
The prototype routes concerns to clinical assessment; it neither diagnoses
nor recommends drugs or tests. SAFE means only that no draft rule matched.

**Screening groups.** Chest pressure or breathing difficulty; injury and loss
of movement; deformity or substantial swelling; sensory loss or persistent
tingling; abnormal limb temperature; sudden/severe/bilateral pain; fever or
systemic illness; relevant cancer history; local inflammation and infection
risk. Side, a 0–10 pain score, and duration are recorded as context, without
invented numeric danger cutoffs. The bank contains 20 questions.

**Routing policy needing approval.** Concerning answers route to clinical
review. Injury alone and inability to move alone remain concerns; their
combination also has an explicit rule. Fever/local inflammation and local
inflammation/infection risk have combination rules. Missing required answers
cannot clear the gate. A first uncertain safety answer repeats a fixed
clarification; continued uncertainty routes to a clinician. Optional context
unknowns stay unknown. Invalid data blocks clearance. Referral urgency and
local wording require clinician localization before any real-world use.

**Evidence.**

- [NHS shoulder pain](https://www.nhs.uk/symptoms/shoulder-pain/): shoulder warnings.
- [NHS heart attack](https://www.nhs.uk/conditions/heart-attack/): chest/breathing symptoms.
- [Leicestershire NHS shoulder guidance](https://www.leicspart.nhs.uk/msk-physiotherapy-resources-getting-started/upper-limb/shoulder/): systemic symptoms/history.
- [StatPearls, Septic Arthritis](https://www.ncbi.nlm.nih.gov/sites/books/NBK538176/): joint inflammation/infection risk.
- [Finucane 2020](https://pubmed.ncbi.nlm.nih.gov/32438853/): spinal red-flag framework, background only; not shoulder validation.

NICE CKS could not be verified during preparation and supports no implemented
rule. These sources do not validate the new questionnaire or software policy.
Exact item-to-source links appear in `shared/questions_shoulder.json` and
`shared/gate_rules.json`; limitations are in `shared/clinical_sources.json`.

**Please review:** omissions, over-referral, combinations, uncertainty policy,
clarification wording, appropriate urgency, local emergency guidance, adult/
paediatric scope, and whether the demo should exclude any populations. Record
item/rule IDs, suggested wording, evidence and decision in `review-log.md`.
No approval should be inferred from a review invitation or this document.
