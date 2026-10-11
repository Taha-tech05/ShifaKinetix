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

## 2. Design

(Filled in as the work is committed.)
