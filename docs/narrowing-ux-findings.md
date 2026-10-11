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

Commits are small and in order: `git log --oneline 3e4e7dc..HEAD`. Nothing is pushed.

### Fix 1: live highlight after every answer

* `evaluateLive` (`narrowing/live.ts`) no longer gates muscles on a structure category. It always returns up to 3 **provisional** muscles (`provisional: true`
  until the question set is finished), seeded from the tapped area before any answer (the hit structure first, then the muscles of the tapped sub-region;
  `flow/live.ts` `seedLiveState`, shown by the screen on the first render) and recomputed from scratch after every answer. A skip changes nothing (unknown adds nothing).
* The existing spatial logic is the only seed (tapped structure and sub-region). The depth question is still not asked, so there is no depth input; this is a limit:
  before any evidence the three muscles are simply the first of the tapped area, not the three most likely.
* Bands (Low / Moderate / Higher) appear only after `minAnswersForBands` = 2 answers that are not unknown, counted over movements and all questions together
  (`shared/narrowing_config.json`). Before that the strip says "Still narrowing - keep going", names the possible muscles, and shows no band.
* Not separated by `leadMargin` means a **cluster**; separated means the top muscle alone. A deep candidate ghosts the muscles over it and candidates cross-fade, as before (tint and ghost, never the base opacity).
* `NarrowingOutput` got an optional `provisional?`, backward compatible. The stub sets it; the engine decides.

### Fix 2: "may not be a muscle problem" only at the end

* The structure scoring keeps running silently. **No** category, "types so far", card or physio action is shown while asking (the strip is muscles only).
* A non-muscle or unclear conclusion is drawn only when every structure question has been answered or skipped (the cap, 8). Until then `outcome` stays "pending".
  A muscle-leading result keeps the normal flow and may stop early on the margin (the only early stop).
* The result screen (the only place with the conclusion) explains in plain words: "Your answers do not point to a muscle. This tool only looks at muscles, so it cannot
  rule out a problem in a joint, a bone or a nerve. A doctor or physio can check this properly." with **Talk to a doctor or physio**. No emergency number, no alarming wording (tested).
* `shared/app_config.json` `ASSISTANT_ENABLED` is false; nothing about an assistant is rendered. The result screen has one commented extension point.
* The gate still runs after every answer; a red flag anywhere escalates at once, as before, and is now logged (`session.escalation`).

### Fix 3: auto camera focus

* `components/body3d/cameraRig.ts`: `boxFocusView` frames the union box of the candidate meshes (`packLayers.structureBounds`), looking from the side of the body the muscle is on
  (behind the middle of the body: from behind; in front: from the front; at the side: from that side) with a small lean to the selected side, distance 1.2 m, zoom fitted with padding 1.7 and clamped 0.8 to 3.
* `startFocus` eases for 0.7 s (smoothstep); with the OS reduce-motion setting on it jumps. Any touch (orbit, pinch, pan) cancels it at once (`userTouched`); the next change of the candidates focuses again.
* It runs only when the candidates changed (`focusPlan.planFocus`) and only on the question phase (`autoFocus={!onMovement}`); the movement-demo presets are unaffected.
* **Re-focus** and **Reset view** buttons on the stage. Pan stays within 0.35 m of the focus target; zoom stays within 0.6x to 3x of the preset. The page does not scroll while a finger is on the model (unchanged).

### Fix 4: one-glance layout

* `app/report/movement.tsx` has no scrolling container around the answers. Column: slim 52 dp header, ONE strip with both the demo and caution messages
  (`DemoCautionStrip`; the global demo banner is not drawn on this screen, `store/chrome.ts`), viewer (43 % of the height, it shrinks down to 140 dp), progress row with **Back**, the compact candidate strip, and the question card.
* Yes / No / Not sure / Skip are one row of chips, each at least 48 dp; movement answers wrap into two rows. Only the question text area scrolls inside the card (`maxHeight` 20 % of the height); the answer buttons are never inside a ScrollView (tested).
* The bottom padding includes the gesture-bar inset.
* Sizes are in `flow/liveLayout.ts` and checked by arithmetic for 360x640, 390x844 and 412x915 at font scale 1.0 and 1.3 (`__tests__/narrowingUx.test.tsx`), and on the emulator (section 4).

### Fix 5: Back and change an answer

* `session.history` is an ordered log of every answer (`seq`, id, answer, time). Changing or undoing an answer sets `supersededAt`; nothing is deleted. Snapshots of a superseded answer are flagged too, and going back appends a snapshot marked `recomputed`.
* `goBack()` (`flow/live.ts`): supersedes the last active answer, **rebuilds `answers` and `movementResults` from the active entries**, runs the Severity Gate again on the full structured state, and recomputes the narrowing and category scores from scratch (tested equal to a fresh run with the same answers).
* **After an escalation back does nothing**; the escalation stays in `session.escalation`. Back is a button next to the progress bar, the header arrow, and the Android back button / swipe. On the first question it asks "Leave this check?" first.
* The question is shown again with the old answer selected; a skipped one comes back as unknown (`state: unknown`, `value: null`), never as no.
* The result has **Review answers**: each current answer with a **Change** button that reopens that question (`/report/movement?review=<id>`); after the change it goes on to the first unanswered question or back to the result.

### Deviations and limits

1. `NarrowingOutput.provisional?` is a new optional field. `evaluateLive` takes an optional `mode` argument.
2. The step order stays: movements (region mode), structure-type questions, muscle questions. In guided-movement mode the strip shows provisional muscles from the movements already.
3. Before any answer the seeded muscles are the first of the tapped area (alphabetical among equal priors), not a ranked guess. A better seed needs positions or a depth answer.
4. Review answers works for movements and questions. Changing an early answer may make more questions necessary; the flow then continues at the first unanswered one.
5. The Urdu and Roman Urdu strings are machine-written: **needs native review**.

## 3. Needs clinician review

| Item | Where | What to confirm |
| --- | --- | --- |
| Wording of the provisional highlight ("Possible so far", "Still narrowing - keep going") | `i18n` `live.possibleSoFar`, `live.stillNarrowing` | that "possible so far" cannot be read as a finding. |
| Minimum answers before bands | `shared/narrowing_config.json` `minAnswersForBands` (2) | whether 2 is enough before a band is shown. |
| Margins and caps | same file: `leadMargin` 0.3, `minMatchedCriteria` 2, `maxQuestions` 9; `structureType`: `leadMargin` 0.25, `minLeaderScore` 0.3, `maxQuestions` 8 | each value. |
| Non-muscle and unclear result wording | `i18n` `live.notMuscleTitle`, `notMuscleBody`, `unclearBody`, `talkPhysio` | that it is neither alarming nor reassuring, and that it states the tool only considers muscles. |
| Which muscles are seeded first | `dev/narrowingStub.ts` priors (`shared/narrowing_config.json` `priors`) | tapped structure 0.15, tapped sub-region 0.05. |
| The rule that a muscle-leading result may stop early but a non-muscle one never does | `narrowing/live.ts` | the clinical safety of that asymmetry. |

## 4. Checked

* **Local CI**: `npx tsc --noEmit` clean; `npm test -- --ci` 301 tests pass; gate parity `npm test -- --ci gate` (4) and `pytest -q tests/test_gate.py` (4) pass. There is no lint script or ESLint config in `mobile/`, so lint was **not** run.
* **Emulator (Pixel 7, Expo Go; not a phone)**: the question screen in Roman Urdu at the default size shows the slim strip with both messages, the model, the compact strip, the question and the four chips in one row, all on screen with no scrolling. The Urdu (right to left) run and the 360x640 at font scale 1.3 run did **not** complete: the emulator's system UI stopped responding during the run, so those two were not seen. The three sizes and both font scales are therefore covered **only by the arithmetic check** (`fixedHeights` in the test), not by eye. Please check them on a phone (section 5).
* Not checked on the emulator: the eased camera move, Back, Review answers (covered by unit tests only).

## 5. Phone test list

1. **Highlight after answer 1 and 2**: open the questions; the model shows possible muscles before the first answer, after the first answer and after a skip; the strip says "Still narrowing" with no band word until the second real answer, then bands.
2. **Auto-focus then manual drag**: after an answer that changes the candidates the camera glides to them (about 0.7 s); put a finger on the model and it stops at once; drag and pinch work; the next changing answer glides again; **Re-focus** and **Reset view** work. With the phone setting "remove animations" on, the camera jumps.
3. **Everything visible without scrolling on a small phone** (360x640 or similar), at normal and large font: header, one strip with both messages, model, strip, question and the four answer chips; nothing needs scrolling to answer. A long question scrolls only inside its own area.
4. **Back and re-answer**: Back button, header arrow and the phone back button each go to the previous question with the old answer selected; changing it updates the highlight and the strip. On the first question Back asks before leaving. After a red-flag screen Back does not bring the questions back.
5. **Non-muscle conclusion only at the end**: answer so that bone, neck or joint leads; no "may not be a muscle problem" appears until the last question; then **See result** shows it with "Talk to a doctor or physio". **Review answers** on the result lets you change an answer.
6. **Urdu (right to left) and Roman Urdu**: all of the above; text not cut, chips on one row, layout mirrored.

## 6. Follow-up: layout was too tight

The first one-glance layout gave the viewer a fixed 43 % and cut the muscle names to one line, so on some phones the names and the option text were cut. Now the viewer takes the height that is left (minimum 80 dp), the strip lists each possible muscle by its full name (two on short screens, three otherwise), and the answer chips are 52 dp with larger text that wraps instead of being cut. Checked by hand by the owner on a phone; covered by tests for the full names and option labels and by the size arithmetic.
