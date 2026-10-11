# Narrowing UX fixes: findings, fixes, review list

Branch `feature/B-narrowing-ux-fixes` (from `feature/B-structure-type`). Nothing pushed.
All clinical content and thresholds are **placeholder - draft from published sources, awaiting clinician review**.

## 1. Step 0: root causes (read-only, before any change)

### 1. Why the muscle highlight appears only after all questions

| Cause | Where |
| --- | --- |
| **Muscles are gated on a structure-category margin.** `evaluateLive` returns `candidates: []` (outcome "pending") for every state where the structure type is not yet decided, i.e. until two real structure answers separate muscle/tendon from the other types by `STRUCTURE.leadMargin`. | `narrowing/live.ts:98-100` (`status !== 'separated'` returns no candidates), `:92-97` (a non-muscle leader or the cap returns no candidates), `:105-107` (even once allowed, no list before `NARROWING.minNonUnknownAnswers` = 2) |
| **In guided-movement mode the structure questions come after the six movements** (`liveSteps`: movements, structure, muscle questions), so through all six movements the strip says "Still narrowing" and nothing is highlighted. | `flow/live.ts:25-33`, `narrowing/live.ts:98` |
| **Candidates need evidence.** Even when allowed, only muscles with at least one matched criterion are listed (`withEvidence`). Before any answer there is nothing to show; the tapped location (hit structure 0.15, tapped sub-region 0.05) is used for ranking but is filtered away. | `narrowing/live.ts:119-121`, `dev/narrowingStub.ts:89-90` |
| **The 3D highlight follows `liveState.candidates` only.** The screen passes `liveState.candidates` to the stage (`highlightIds`), so an empty list means no highlight. The result screen is the first place where a list reliably exists. | `app/report/movement.tsx:81-84` |
| There is no "provisional" notion: a list is either a conclusion or nothing. | `narrowing/live.ts` (`LiveState` has no such field) |

### 2. Where "may not be a muscle problem" is triggered, and why it shows early

* The engine **concludes as soon as the structure step separates a non-muscle leader**, after only 2 real answers, or when the structure cap is reached:
  `narrowing/live.ts:92-97` sets `outcome: 'category'`, `categoryResult` and `stop: true`.
* The flow obeys `stop` and ends the questions (`flow/live.ts` `nextStepIndex`: `if (outcome.state?.stop) return null`), so the conclusion arrives after 2 to 8 questions, not at the end.
* The live strip shows the card as soon as `outcome === 'category'` (`components/narrowing/CandidateStrip.tsx:76-104`, headline `live.notMuscleTitle`), and the live screen offers "Talk to a doctor or physio" in the same moment (`app/report/movement.tsx`, `finished` block).
* While deciding, the strip also shows the category rows ("Types so far", `CandidateStrip.tsx:107-115`), i.e. a partial category conclusion during the questions.

### 3. How the camera is controlled during questions

* The camera state lives in `components/body3d/cameraRig.ts`. The only automatic movement is `setPreset` (`cameraRig.ts:119`), called from `MovementStage.tsx:95` when the **movement** (or side) changes: it eases to that movement's preset unless the user has touched the camera.
* On question steps the stage keeps the last movement, so no preset change happens and the camera never moves: the highlight can be on a muscle that is out of frame or on the back of the body. Nothing computes where the candidates are.
* A touch (`useViewerGestures.ts`) calls `userTouched` and stops any easing; Reset view goes back to the movement preset. There is no "focus on the candidates" and no re-focus button.

### 4. The screen layout

* `app/report/movement.tsx:122` puts the whole lower part (progress, strip, question card) in a **`ScrollView`**, so the answer buttons can be below the fold; the model takes **55 %** of the height (`:115`).
* Chrome above the content: the global demo banner (`app/_layout.tsx:19-21`, `components/Banner.tsx`), a separate caution strip (`CautionStrip`, in `Screen`'s `banner`), and a 56 dp header (`components/ScreenHeader.tsx`), about 150 dp before the viewer on a 640 dp phone.
* Answer chips are built from `AnswerChip` with `flexWrap: 'wrap'` (`movement.tsx` styles), so Yes / No / Not sure and Skip (a separate text button) end up on two or three rows.

### 5. How answers are stored; is history or back possible

* `session.recordAnswer` **replaces** an earlier answer to the same question (`store/session.ts:68-71`); `recordMovement` does the same. There is no ordered history, no timestamp per answer, no superseded flag.
* `narrowingTrail` is append-only snapshots (`session.ts` `recordNarrowing`), not tied to answers that were later replaced.
* The step index is local React state in the screen (`movement.tsx:60-68`); there is **no Back control** on a question. The header back arrow calls `router.back()` and leaves the flow; the hardware back button does the same. Going back and answering again would leave the old answer in place until overwritten.
* A red flag already escalates immediately (`flow/live.ts` `afterAnswer` routes with `routeAfterGate`), but the escalation is not logged separately and nothing prevents re-entering the flow afterwards.

## 2. Fixes

(Filled in per commit below.)
