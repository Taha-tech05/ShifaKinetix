# Movement UX fixes: findings, fixes, review list

Branch `feature/B-movement-ux-fixes` (from `feature/B-intake-flow`). Nothing pushed.
All clinical content here (movements, angles, questions, expected-response profiles, camera presets, band thresholds,
margin and cap) is **placeholder - draft from published sources, awaiting clinician review**.

This file has three parts: 1. root causes found before any code change (Step 0), 2. what was changed (filled in as the
work is committed), 3. the "needs clinician review" list and the phone checklist.

## 1. Root causes (Step 0, read-only investigation)

Files read: `app/report/movement.tsx`, `feel.tsx`, `followup.tsx`, `result.tsx`, `components/movement/MovementStage.tsx`,
`MovementPlayer.tsx`, `components/body3d/{Body3D,SegmentedBody,ResultBody,usePack}.tsx`, `src/movement/*`,
`src/dev/narrowingStub.ts`, `src/dev/followUpQuestions*.ts|json`, `src/flow/*`, `src/store/session.ts`,
`src/components/Screen.tsx`, `ScreenHeader.tsx`, `shared/*.json`.

### Problem 1: cannot rotate or zoom while the movement plays; the model looks more transparent

| # | Question from the brief | Answer | Where |
| --- | --- | --- | --- |
| a1 | Separate scene or viewer? | **Yes.** The picker and the result use `Body3D` (one canvas, merged pack meshes, turn-the-model gestures). The movement screen uses a different component, `SegmentedBody`, with its own canvas, lights and materials. They only share the pack. | `MovementStage.tsx:61`, `SegmentedBody.tsx:221-227`, `Body3D.tsx:192-200` |
| a2 | Camera locked to a preset? | **Yes.** The camera is placed once from two hard-coded presets (`front` / `side`, one target and one distance for every movement) in a `useEffect` that depends on the view only. There is no camera state at all, so nothing can change it. | `SegmentedBody.tsx:60-62`, `:133-143` |
| a3 | Animation loop resetting the camera every frame? | **No.** `useFrame` only writes segment matrices (`setMatrix`, `:170-172`) and the resist arrow. It never touches the camera. (This stays true and is now tested.) | `SegmentedBody.tsx:158-205` |
| a4 | Gestures disabled? | **Yes, never added.** `SegmentedBody` has no `PanResponder` or any touch handler. `Body3D` has one (`Body3D.tsx:152-190`). That is the whole reason one finger and pinch do nothing. | `SegmentedBody.tsx:219-229` |
| a5 | ScrollView stealing touches? | Not the cause of "cannot rotate" (there is no handler to steal), but it **would be** once a handler exists: the movement screen is a `ScrollView` (`Screen.tsx:27-31`) and the viewer sits inside it, with no way to switch scrolling off while a finger is on the model. | `Screen.tsx:27`, `movement.tsx:51` |

**Why it looks more transparent (cause, not a feeling):** `buildSegments` makes a `dimmed` material with
`transparent: true, opacity: 0.25, depthWrite: false` (`SegmentedBody.tsx:72`) and gives it to **every muscle that is not
the suggested one** whenever a movement suggests a structure (`:90`, `:130`, default `dimOthers = true` at `:120`).
Almost all of the visible muscle layer therefore drew at 25 % opacity with no depth write. The picker never does this: its
materials are opaque and it highlights by changing vertex colours (`loadPack.highlightMesh`, cyan fill + dark outline).
Lighting also differs: picker `ambient 1.2` + directional `(3,5,4)` (`Body3D.tsx:195-196`), movement `ambient 1.2` +
directional `(0.5,2,3)` or `(-3,2,0.5)` depending on the view (`SegmentedBody.tsx:141`, `:212-213`). So it looks like a
different, faded model, although the geometry is the same pack.

### Problem 2: narrowing only runs at the end

* `runNarrowing` / `narrow` are called **only** from `result.tsx:27` (once, on screen mount). Nothing is called after a
  movement (`movement.tsx`, `feel.tsx` just `recordMovement` then route on) or after a follow-up question
  (`followup.tsx` just `recordAnswer`). `flow/intake.ts:60-64`.
* The stub (`dev/narrowingStub.ts:61-80`) ignores the answers apart from a hash of the ids, a bonus for the tapped
  muscle, and a **penalty that lowers every confidence when answers are "unknown"** (`:45-47`, `:67`). That breaks the
  rule "a skip never lowers a candidate". The discriminator and movement answers do not change which muscle is first.
* There is no early stop, no "still narrowing", no bands, no cap. The result screen shows a **numbered, ranked list**
  (`result.tsx:78-95`, rank badges 1, 2, 3), which is a ranked differential and must go.
* The input type has no place for the follow-up answers (`NarrowingInput`, `dev/narrowingStub.ts:12-23`): only the depth
  answer and the movement results reach narrowing.
* The 6 movements and 3 follow-up questions are separate screens (`movement.tsx` -> `feel.tsx` -> next), so there is no
  screen where the model, a candidate list and a question are visible together.
* Question bank: `shared/questions_shoulder.json` holds only the 3 gate placeholders (Q_DANGER_A/B, Q_GENERAL_C). The
  follow-up questions live in `src/dev/followUpQuestionsStub.json` (Person C placeholder). Audit result: no
  double-barrelled item exists today. "Does lifting your arm make it worse?", "Does it bother you at night?" are
  single-idea. The depth question offers 3 mutually exclusive answers about one idea (depth), so it is not
  double-barrelled either. No bank of discriminator questions with expected responses exists; the brief's example
  ("worse lifting overhead or rotating outward?") is not in the repo, so the discriminator bank is new.
* Gate: `session.runGate()` is only called from `danger.tsx` and `reask.tsx` (after the red-flag questions). Movement and
  follow-up answers never reach it. The gate input has no "sudden injury / trauma onset" and no "unable to lift the arm"
  entry: the trauma wording is a plain chip on the basics screen (`basics.tsx:28-30`, `Q_BASICS_HOW`), and
  "could not do it" is only `unableToDo` inside the movement result.

### Problem 3: hand-behind-back unclear

* The movement uses `view: 'side'` (`movements_shoulder.json`, `hand_behind_back`), so `SegmentedBody` looks from the
  patient's right along -x (`SegmentedBody.tsx:137`): the arm goes behind the trunk and the trunk hides it.
* The camera target and distance are global constants (`TARGET`, `DISTANCE = 1.9`, `SegmentedBody.tsx:60-61`), framed on
  the right shoulder and arm for every movement, not per movement and not head-to-pelvis.
* Only the **right** arm is rigged (`arm_rig.json`, `scripts/build-arm-rig.mjs` filters `side !== 'right'` at the
  segment loop). The left shoulder cannot be animated, and `movement.tsx` never reads the selected side
  (`session.selection.regionId`).
* The pose is shoulder extension -30, rotation -70, elbow 100, held; the hand never goes behind the pelvis and up the
  back as a path, and the test values were never checked against the torso (the earlier report only records it as a
  suspicion).

### Problem 4: UI defects

* **(a) is missing from the brief** (it goes from the heading straight to b).
* **(b) Clipped result title: not reproduced.** I did not have your screenshot. On the emulator (Pixel 7, English and Urdu) the old
  and new result screens show the title fully under the header: `Screen` is a column (header, body), the demo banner already
  handles the status-bar inset (`_layout.tsx:15`), and the title is not under anything. The only code that could cut a title is the
  fixed line height (`typography.ts`: h1 24/32), which is too tight for Urdu marks. Defensive fixes were made (below); if it still
  happens on your phone, send the screenshot and the phone model.
* **(c)** the old result used fixed-height chips (`result.tsx`, `height: 32`), which cut wrapped text.

## 2. What was changed

Commits are small and in order (nothing pushed): `git log --oneline 9685c5d..HEAD`.

### Problem 1: rotate and zoom while the movement plays; same look as the picker

| Cause (section 1) | Fix | Where |
| --- | --- | --- |
| a1 two different viewers | The movement view stays a separate component (it has to split meshes into moving segments) but now shares everything that decides the look with the picker: field of view, the key light and ambient light, and the material parameters. `createBodyMaterial()` makes the base material for the pack **and** for the animated body: opaque, depth written, same roughness. | `components/body3d/viewerSetup.ts`, `StudioLights.tsx`, `Body3D.tsx`, `screens/model3d/loadPack.ts`, `segmentBuild.ts` |
| transparency | The 25 % dimming material is gone. Nothing lowers the opacity of the model. A candidate is **tinted** (cyan, with a soft glow) and, only when it lies deep, the superficial muscles over it are **ghosted** (those muscles only, by their own material). At tint 0 and ghost 0 a material is exactly the picker's. | `segmentBuild.fadeMaterial`, `highlightPlan.ts` |
| a2 camera locked | Camera state is its own object (yaw, pitch, distance, target, zoom, fov). The preset is the initial view and eases in once. | `components/body3d/cameraRig.ts` |
| a4 no gestures | One finger orbits, two fingers pinch (zoom) and pan. Limits: pitch -1.0 to 1.2 rad, zoom 0.6x to 3x the preset, pan 0.35 m from the preset target. The handler refuses to give the touch back, so the page cannot steal it. | `useViewerGestures.ts`, `cameraRig.ts` |
| a3 (not a cause) | Made a rule and tested: the animation only writes segment matrices (`stepClock`, `armTransforms`); the camera is moved only by `CameraDriver` from the camera state. A touch cancels auto-framing; a new preset (next movement) never moves a camera the user has moved; **Reset view** hands the camera back to the preset. | `movement/animationStep.ts`, `SegmentedBody.tsx` |
| a5 ScrollView | The viewer reports touch start and end; the screen switches its own scrolling off meanwhile (`Screen scrollEnabled`). | `Screen.tsx`, `MovementStage.tsx`, `movement.tsx`, `result.tsx` |
| (d) buttons | **Reset view** and **Replay** on the stage. A **Muscle / Bone** toggle was also missing on the patient stage (it only existed on the dev screen) and is added. | `MovementStage.tsx` |
| (e) loop | out, hold about 1 s at the end pose, return slower (return at least 1.2x the way out). Loops are now 4.5 to 9 s (was 4 to 5): the speed limit (90 deg/s) still holds. | `movements_shoulder.json` (`timing`), `movements.test.ts` |

### Problem 3: hand behind back

* **Camera presets** for all six movements (position, target, fov, zoom; right side, the left mirrors x). Hand behind back is seen from behind and 35 degrees to the selected side (`yaw = pi + 0.61`), target at mid-trunk height 1.25 m, 1.7 m away. The others: sideways raise from the front, 17 degrees to the side; forward raise and can position front-oblique; outward push nearly frontal; belly press front-oblique. The preset distance is between 1.5 and 2.05 m, so the upper body fills the stage (a test enforces "not a close-up of one joint").
* **Selected side**: a left-arm rig was built from the left meshes by the same script (`scripts/build-arm-rig.mjs left`, `src/data/arm_rig_left.json`). The model is symmetric to 3.6 mm at the pivots. The left transforms are the right-arm maths on mirrored pivots, reflected back (`S M S`, `rig.ts`). `movement.tsx` reads the side from the selection (`sideOfRegion`). Resist arrows and suggested muscles are mirrored too.
* **Kinematics (placeholder, for physio review)**: shoulder extension 30 to 50 degrees with a small inward part (plane 80), internal rotation 80 to 90, elbow 0 to 85. Order: the arm goes back with the elbow still straight, it turns in, **then** the elbow bends so the hand passes behind the pelvis (hand about 0.95 m high), then it slides up the lower back (about 1.1 m, lumbar level), holds about 1 s, and returns the same way, slower. Negative elevation now means "the opposite of the plane's direction" (plane 90 = straight back, plane 0 = inward), which is what allows extension and adduction together; the old rule (always straight back) is the plane-90 case. The scapula rule and the smoothing are unchanged.
* **Interpenetration**: measured on the real pack (`__tests__/support/clearance.ts`): a height map of the back and front surface of everything that does not move, and every sampled vertex of the moving segments tested against it, for all six movements and both sides, along the whole loop. A first, straight-line path (rest to final pose in one move, plane 0) put the hand 95 mm into the trunk. Fixed by changing the **path**, not by hiding anything: the plane at rest equals the plane of the move (it has no effect at zero elevation), and the elbow only bends after the arm is back and turned in. Result for hand behind back: deepest overlap upper arm 15 to 17 mm (soft-tissue meshes touching), forearm 0, hand 4 mm; the palm stays at least 64 mm behind the back surface through the reach (left 64, right 65). Limits in the test: upper arm 20 mm, forearm 12 mm, hand 15 mm.
* **Clarity aids** (none changes the base opacity): moving segments tinted (a light blue multiplier on the pack's colours, opacity 1); a faint translucent teal copy of the arm at the end pose that fades out as the arm arrives (so it does not wash the real arm); an amber line along the palm's path, for hand behind back only.
* Note kept in the data: "Adapted from clinician-administered positions (lift-off / Apley scratch); self-administered version not validated." (`movementNote`).
* **Appendix A deviation (flagged)**: the redesigned movement goes outside the Appendix A ranges (elevation to -50 instead of -45, rotation to -90 instead of -80, elbow passes through 0 to 85 on its way). The appendix ranges are kept as `appendixAllowed`; the working ranges (`allowed`) are widened and `allowedNote` says a physiotherapist must confirm both.

### Problem 2: live narrowing

* Layout (portrait): model on top (55 % of the screen's content height, the same stage for every step and the result), then the candidate strip, then the question card with tap-to-answer chips. `app/report/movement.tsx` is now this screen for movements **and** questions; `feel.tsx` and `followup.tsx` are kept as routes that redirect here (still behind `SafeGuard`). The patient can turn and zoom the model at every step. On question steps the arm rests and the current candidates are tinted.
* After **every** answer (`flow/live.ts`): the answer is stored, the Severity Gate is run again through the existing interface (`session.runGate`), then (SAFE only) `narrow()` is called, the live state is stored, and a snapshot is appended to `session.narrowingTrail` (step, id, answer, full live state, gate verdict, time). A non-SAFE verdict stops the flow and routes with the existing `routeAfterGate` (RED_FLAG to `/report/urgent`). "Not sure" and "Skip" are `state: unknown` with `value: null`; they are counted as asked (towards the cap) and never as answers.
* Stub scoring (`narrowing/scoring.ts`): a candidate's strength is `prior + (matched - 0.5 * unmatched) / 3`, clamped to 0..1. Only answered criteria count; unknown ones are not in the formula at all, so they cannot lower anything (tested: adding any number of unknown answers changes no strength and no order). The old stub lowered every confidence by 10 % per unknown answer; that is removed (and its test replaced).
* Stop rules (`narrowing/live.ts`, constants in `shared/narrowing_config.json`): no list until 2 answers that are not unknown; stop when the top candidate leads the next by 0.3 and has at least 2 matched criteria ("Thanks, that's enough to go on"); or at 9 questions asked. If the candidates are not separated they are shown together as one cluster, never as one forced muscle.
* Display: band (Low / Moderate / Higher) and a match bar, captioned "match strength, not a probability". No percent sign, no number and no rank anywhere (tests scan the strings and the rendered text). The result no longer numbers its list.
* 3D: candidates are tinted and cross-fade (0.35 s) when the list changes; a deep candidate ghosts the superficial muscles over it (same side, shared sub-region) so it can be seen; the result adds leader-line labels (muscle name only) projected from the candidate's position in the model.
* The result screen reads `session.liveState` and does not call `narrow()` (tested with a counter); each candidate shows what matched and what did not.
* Gate inputs: `Q_ONSET_SUDDEN_TRAUMA` (from the basics answer: after an injury or suddenly) and `Q_UNABLE_TO_MOVE_ARM` (from "could not do it") are built as answers in the shared format and added to what the gate sees. **No gate rule was added or changed**; the gate files are untouched. Until Person A writes a rule that names these two ids, the gate does not react to them.
* Question bank: `shared/narrowing_bank_shoulder.json`, 7 yes/no questions, one idea each, each with the muscles a "yes" supports (draft). Audit: no double-barrelled item existed in the repo; the brief's example is split into `Q_DQ_OVERHEAD` and `Q_DQ_ROTATE_OUT`.

### Problem 4: UI

* New strings in English, Urdu and Roman Urdu (`live.*`, `movement.replay`, `resetView`, `viewHint`, `layerLabel`). Urdu and Roman Urdu are machine-written and flagged "needs native review" (file headers and the bank note).
* Chips and rows wrap and use minimum heights only (a test fails on any fixed-height box above 8 px in the touched files).
* The result title has top padding, and `AppText` gives Urdu text 1.35x line height (`components/AppText.tsx`), so tall Urdu marks are not cut.
* The safe-area handling was already correct (see section 1), so it was not changed.

### Deviations from "interface unchanged", for you to veto

1. `NarrowingInput` got an **optional** `answers?: Answer[]`. Without it the discriminator answers cannot reach `narrow()`.
2. `Candidate` got optional `matched?` and `unmatched?` (ids of the criteria). Used for the "why" text and the early-stop rule.
Both can be ignored by a replacement implementation: the engine works without them (tested), it then simply never reaches "enough" and the "why" says "Based on the area you marked". The function name, argument and the three required output fields are unchanged.
3. The stub's internals changed (the penalty for unknown answers is removed because it breaks the rule that a skip never lowers a candidate), so its two old tests were changed to match.
4. The depth question (`Q_DEPTH_PLACEHOLDER`) is no longer asked in the live flow (it never changed the ranking, and the earlier design change said to ignore the depth picker). The code and its tests are still there.

## 3. Needs clinician review

Everything below is **placeholder - draft from published sources, awaiting clinician review**. Nothing is called validated.

| Item | Where | What to confirm |
| --- | --- | --- |
| Hand-behind-back angles and path | `movements_shoulder.json` (`hand_behind_back`, `kinematicsNote`) | extension 30 to 50, plane 80 (a little adduction), internal rotation 80 to 90, elbow 0 to 85, the order (back, turn in, bend, slide up), the 1 s hold, the 9 s loop. Whether "about 90 degrees of elbow flexion" must be reached (the model reaches 85: more makes the hand press into the back). The widened ranges against Appendix A (`appendixAllowed`). |
| Hand height | same | the hand rises from about 0.95 m (pelvis) to about 1.1 m (taken as lumbar level). Which spine level is meant. |
| Camera presets (six) | `movements_shoulder.json` (`camera`) | only framing, no clinical content, but the view of each movement (for example that hand behind back is seen from behind) should be agreed. |
| Expected-response profiles | `movements_shoulder.json` (`suggestsStructures`), `shared/narrowing_bank_shoulder.json` (`supports`) | which muscles a movement or a "yes" supports. The left side reuses the right side's list mirrored. |
| Question wording | `shared/narrowing_bank_shoulder.json` | the 7 questions and their order; the Urdu and Roman Urdu text (machine-written, **needs native review**). |
| Band thresholds | `shared/narrowing_config.json` (`bands`) | Low below 0.35, Moderate from 0.35, Higher from 0.6 of the match strength. |
| Margin, cap, minimum answers | same | lead margin 0.3, at least 2 matched criteria, cap 9 questions, at least 2 answers that are not unknown before any list, 3 matched criteria for a full match, a "no" counts half a "yes", priors 0.15 / 0.05 / 0.02. |
| Gate inputs | `flow/gateInputs.ts` | that "after an injury" and "suddenly" both mean `Q_ONSET_SUDDEN_TRAUMA = true`; that one "could not do it" on any movement means `Q_UNABLE_TO_MOVE_ARM = true`; the ids themselves (Person A owns the rules). |
| Which muscles are "overlying" | `highlightPlan.ts` | same side, shares a sub-region, in the pack's superficial layer. It is a geometric guess, not anatomy. |
| Clearance limits | `__tests__/handBehindBack.test.ts` | what overlap of soft-tissue meshes is acceptable (upper arm 20 mm, forearm 12 mm, hand 15 mm). |

## 4. What to test on a real phone

1. **Orbit and zoom while animating**: on every movement, drag with one finger, pinch with two, drag with two. The model must follow your fingers, keep playing, and never snap back. The page must not scroll while a finger is on the model. **Reset view** must return to the starting view; **Replay** must start the movement again.
2. **Opacity match with the picker**: open the body picker, then a movement. The model must look the same (solid, same colours and light). Only the moving arm is slightly tinted and the candidates are cyan.
3. **Live narrowing after each answer**: answer, skip and choose "Not sure" in different orders. After the second real answer a candidate strip appears; "Not sure" and "Skip" must never make a candidate drop. Check that the model highlight changes without flicker.
4. **Early stop**: answer so that one muscle clearly wins; "Thanks, that's enough to go on" and **See result** must appear. Also run to the cap (9 questions) with mixed answers: the candidates must appear together as one cluster.
5. **Hand-behind-back clarity**, **both sides**: choose the left shoulder and the right shoulder. The view is from behind, 35 degrees to the chosen side; the forearm must cross behind the trunk, the hand must slide up the lower back, the amber path line and the faint end-pose copy must help, nothing should pass through the body.
6. **Deep-muscle visibility**: pick answers whose candidate is supraspinatus, subscapularis or infraspinatus (deep). The muscles over it must fade so it can be seen, the rest of the body must stay solid.
7. **Result**: labels (muscle name only) join the right muscles; the list shows bands and match bars only; no number, no percent; the "Not a diagnosis" and "Estimate" chips, the caution line, the demo banner and SOS are visible.
8. **Urdu (right to left) and Roman Urdu**: every screen above. Text must not be cut, chips must wrap, the layout must mirror (switching to Urdu needs an app restart to mirror fully).
9. Frame rate and heat after 5 minutes of looping (the emulator is software-rendered and is not a measure).

## 5. Checked on the emulator (Pixel 7, Expo Go, software GL; not a phone)

Done: live screen in English, Urdu (RTL) and Roman Urdu; candidate strip with bands and bars; cyan tint on a candidate and ghosted
chest muscles over deep ones; result with a leader label, no clipping; one-finger orbit turns the model, **Reset view** restores it,
**Bone** layer works; all six camera presets at the hold; hand behind back from behind on the left side. The model is solid and looks
like the picker. Not possible with adb: pinch and two-finger pan (checked only by the unit tests of the camera maths).
Frame rate on the emulator is 13 to 24 fps with the end-pose copy and trail on hand behind back (about 22 to 26 before). Measure on a phone.

## 6. Local CI

`npx tsc --noEmit` clean; `npm test -- --ci` all suites pass; gate parity: `npm test -- --ci gate` (4) and `pytest -q tests/test_gate.py` (4) pass.
There is no lint script or ESLint config in `mobile/`, and `ruff` is not installed here, so lint was **not** run.
Pack SHA-256 unchanged; no change under `gate/`, `shared/gate_*`, `server/`, `.github/`, `mobile/src/gate/`.
