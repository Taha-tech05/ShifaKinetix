# Structure type before muscle: findings, design, review list

Branch `feature/B-structure-type` (from `feature/B-movement-ux-fixes`). Nothing pushed.
All clinical content is **placeholder - draft from published sources, awaiting clinician review**.

## 1. Step 0: what the code does today (read-only, before any change)

### (1) Is a depth or structure-type question asked today?

**No.**
* The only depth question is `Q_DEPTH_PLACEHOLDER` in `mobile/src/dev/followUpQuestionsStub.json` ("just under the skin, deep inside").
  Since the live flow replaced `followup.tsx` (`app/report/followup.tsx` is now a redirect), nothing asks it: no file under
  `app/` or `flow/` imports `depthQuestion`.
* Its answer was never used for ranking anyway: `NarrowingInput.depthAnswer` is set in `store/session.ts:105`
  (`depthAnswerFrom`), and the only reader is `unknownCount` in `dev/narrowingStub.ts:58-60`, which is informational.
* The discriminator bank (`shared/narrowing_bank_shoulder.json`) has 7 questions about which **movement** hurts. None asks what
  **kind** of structure hurts (bone, joint, nerve, muscle).

### (2) Is the tapped layer (Muscle / Bone) used in scoring?

**No.** `NarrowingInput.layer` exists (`dev/narrowingStub.ts:20-21`) and `session.narrowingInputFrom` fills it
(`store/session.ts:100`), but `narrow()` (`dev/narrowingStub.ts:79-95`) never reads it. It reads `regionId`, `subRegionId` and
`hitMeshName` only. `selection.layer` is used for the body picker and for `highlightNamesFor` (`regions/regionMap.ts:58-68`),
nothing else. So tapping on a bone and tapping on a muscle give the same narrowing.

### (3) Why does the candidate set contain only muscles?

Four reasons, all in the code:
1. The pool is `musclePool(side)` (`dev/narrowingStub.ts:69-73`): structures with `kind === 'muscle'` **minus** names matching
   `/ligament|capsule|disc|labrum/` (`:54`). In `shared/regions_shoulder.json` the kind is only `muscle` or `bone`
   (43 muscle-kind and 6 bone-kind structures per side); the capsule, ligaments and discs are stored as `muscle` and then
   filtered out by that regex, and the 6 bones (humerus, clavicle, scapula, labrum, two discs) never enter the pool.
2. The scoring evidence (`narrowing/scoring.ts`) is made of lists of muscle ids: `suggestsStructures` in
   `movements_shoulder.json` and `supports` in `shared/narrowing_bank_shoulder.json` name muscles only. A bone or a joint can never
   score.
3. `Candidate.muscleId` and the live engine (`narrowing/live.ts`) treat every candidate as a muscle; the strip and the result show
   muscle names (`components/narrowing/CandidateStrip.tsx`, `app/report/result.tsx`).
4. There is no step before the muscle ranking that asks whether this is a muscle problem at all, so a bone, joint or nerve problem
   is always reported as the "closest" muscles.

### Consequence

A patient whose pain comes from the AC joint, a bone, or the neck still gets a list of muscles with bands. The design below
adds a structure-type step first, and shows muscles only when the answers point to muscle or tendon.

## 2. Design and what was built

**Flow.** In guided-movement (region) mode the six animated movements come first, then the structure-type questions, then the muscle questions (exact mode has no movements, so it starts with the structure-type questions). They are asked one per screen, with the same tap-to-answer chips, and the gate and narrowing run
after every one (`flow/live.ts`, unchanged mechanism). The state after each answer says which type leads:

* fewer than 2 answers that are not unknown: "Still narrowing - keep going", nothing shown;
* a leader (score at least 0.3 and ahead of the next by 0.25):
  * **muscle or tendon**: the remaining structure questions are skipped and the movements and muscle questions follow, exactly as before. Muscle candidates may now be shown;
  * **joint, bone or nerve/neck**: the flow stops with a **category result** ("This may not be a muscle problem") and the actions **Talk to a doctor or physio** and **See result**. No muscle is listed;
* no leader after 8 structure questions: result **Unclear**, same actions, no muscle. A muscle is never forced.

**Scoring** (`narrowing/structureType.ts`): each answer adds the signed weight of the expected-response table to each category; the score is the
sum over 3, between 0 and 1. Only answered yes/no count: "Not sure" and "Skip" add nothing, so a category never goes down
because of an unknown answer (tested: adding unknown answers changes no score and no order). The score is a match strength, shown as a band
(Low / Moderate / Higher) with a bar and "match strength, not a probability". No number, no percent.

**Candidate model.** `Candidate` gets an optional `kind` ("muscle" or "category"). `narrow()` now also returns the four categories
(`kind: "category"`, `muscleId` holds the category id) after the muscles. A replacement that does not return categories leaves the muscle
flow as it was (tested). `NarrowingInput.answers` (added earlier) carries the structure answers too.

**Where it lives.** Questions and table: `shared/structure_type_bank_shoulder.json`. Constants (margin, minimum answers, cap, full score):
`shared/narrowing_config.json`, key `structureType`; bands are the existing `bands`. Code: `narrowing/structureBank.ts`, `structureType.ts`,
`approxArea.ts`, `live.ts`.

**Gate inputs** (`flow/gateInputs.ts`; no rule was added or changed, the gate files are untouched). On every answer the gate now also sees, as answers
in the shared format: trauma (`Q_ONSET_SUDDEN_TRAUMA`), bone tenderness after trauma (`Q_BONE_TENDER_AFTER_TRAUMA`: yes only when both are yes, no from
a real no, unknown from a skip, absent if not asked), numbness or weakness (`Q_NUMB_OR_WEAK`: yes from tingling, numbness or a weak movement),
and inability to lift the arm (`Q_UNABLE_TO_MOVE_ARM`). Until Person A writes rules that name these ids, the gate does not react to them.

**Snapshots.** Each answer appends a snapshot to `session.narrowingTrail`; its state now includes `structure` (asked, answered, status, leader and the
category scores with bands) and `outcome`, `muscleAllowed`, `categoryResult`.

**Screens.** The result is titled **Structures that may be involved** and shows exactly the last live state (no recomputation). A category
result shows the type, why (what matched and what did not), and the actions. For types with no mesh the nearest region is highlighted and
the label says **approximate area**: joint or capsule shows the shoulder capsule and ligaments, bone shows the humerus, scapula and clavicle
(the viewer switches to the bone layer), nerve or neck shows the muscles at the side of the neck. Strings are in English, Urdu and Roman Urdu; the
Urdu and Roman Urdu text is machine-written and flagged "needs native review".

### Expected-response table (placeholder)

| Id | Question (English) | Yes adds | No adds |
| --- | --- | --- | --- |
| `Q_ST_BONE_POINT` | Is there one small spot on a bone that is very sore when you press it? | BONE +1.5, MUSCLE_TENDON -0.25 | MUSCLE_TENDON +0.5, JOINT_CAPSULE +0.25, BONE -0.5 |
| `Q_ST_PASSIVE_BETTER` | When your other hand helps lift your sore arm, does it go higher than on its own? | MUSCLE_TENDON +1 | JOINT_CAPSULE +0.5 |
| `Q_ST_TINGLE` | Do you feel tingling in your arm? | NERVE_NECK +1 | MUSCLE_TENDON +0.25, NERVE_NECK -0.5 |
| `Q_ST_NUMB` | Does any part of your arm feel numb? | NERVE_NECK +1 | MUSCLE_TENDON +0.25, NERVE_NECK -0.5 |
| `Q_ST_NECK` | Does moving your neck bring on your shoulder pain? | NERVE_NECK +1, MUSCLE_TENDON -0.25 | MUSCLE_TENDON +0.25, NERVE_NECK -0.5 |
| `Q_ST_STUCK_ASSISTED` | Is your arm stuck even when your other hand helps it? | JOINT_CAPSULE +1, MUSCLE_TENDON -0.5 | MUSCLE_TENDON +0.5 |
| `Q_ST_NIGHT` | Does the pain wake you at night? | JOINT_CAPSULE +0.5, MUSCLE_TENDON +0.5, BONE +0.25 | - |
| `Q_ST_CROSS_BODY` | Does pulling your arm across your chest hurt the very top of the shoulder? | JOINT_CAPSULE +1, BONE +0.25 | MUSCLE_TENDON +0.25 |
| `Q_ST_CATCH` | Does your shoulder catch when you move it? | JOINT_CAPSULE +1 | MUSCLE_TENDON +0.25 |
| `Q_ST_GIVEWAY` | Does your shoulder feel like it gives way? | JOINT_CAPSULE +0.75, MUSCLE_TENDON +0.25 | - |
| `Q_ST_CLICK` | Does your shoulder click when you move it? | JOINT_CAPSULE +0.5 | - |

Categories: MUSCLE_TENDON, JOINT_CAPSULE, BONE, NERVE_NECK. UNCLEAR is the outcome when no category leads.

### Deviations to be aware of

1. `Candidate.kind` is a new optional field and `narrow()` returns extra candidates (the categories). Anything that reads `candidates` as all muscles must filter on `kind`. The live engine does.
2. The step order: movements, then structure-type questions, then muscle questions. (A first version put the structure questions before the movements, so guided movements opened on questions instead of the animation; fixed.) While the movements are being done the strip says "Still narrowing", because muscles may be shown only once muscle or tendon leads.
3. The depth question is still not asked; this step replaces what it was meant to do.
4. Bone tenderness "after trauma" uses the basics answer "after an injury" or "suddenly" as trauma (a placeholder choice).

## 3. Needs clinician review

| Item | Where | What to confirm |
| --- | --- | --- |
| Question wording (11 questions) and order | `shared/structure_type_bank_shoulder.json` | one idea each, plain words; the order puts the bone, the assisted movement and the nerve questions first. Urdu and Roman Urdu **need native review**. |
| Expected-response table per category | same, `yes` / `no` | every weight above, including that some "no" answers support muscle or tendon. |
| Margin, minimum answers, cap, full score | `shared/narrowing_config.json` (`structureType`) | lead margin 0.25, leader at least 0.3, at least 2 real answers, cap 8, full score 3; band thresholds 0.35 and 0.6 (unchanged). |
| Approximate areas | `narrowing/approxArea.ts` | joint = shoulder capsule and ligaments; nerve or neck = descending trapezius and levator scapulae (the model has no neck nerves); bone = humerus, scapula, clavicle. |
| Gate input definitions | `flow/gateInputs.ts` | what counts as trauma, as bone tenderness after trauma, as numbness or weakness; the ids (Person A owns the rules). |
| The decision to stop with a category result | `narrowing/live.ts` | that a clear non-muscle leader ends the questions and sends the patient to a doctor or physio. |
| Wording of the result | `i18n` `live.*` | "This may not be a muscle problem" and the two explanations. |

## 4. Checked

* Emulator (Pixel 7, Expo Go; not a phone): a bone-leading result shows the bone layer with the humerus, scapula and clavicle tinted, one leader label "Clavicle (approximate area)", the title "Structures that may be involved", the "Not a diagnosis" and "Estimate" chips, the caution line, and **Talk to a doctor or physio**. The nerve and joint results were seeded the same way but not reviewed by eye.
* Local CI: `npx tsc --noEmit` clean; `npm test -- --ci` 257 tests pass; gate parity `npm test -- --ci gate` (4) and `pytest -q tests/test_gate.py` (4) pass. No lint script exists in `mobile/`, so lint was not run.
* Known weakness: muscle or tendon can win after only two answers (for example "no" to a sore bone spot and "yes" to the assisted lift). That is a placeholder setting (`minNonUnknownAnswers` 2); the clinician should say whether more answers are needed before muscles are shown.
