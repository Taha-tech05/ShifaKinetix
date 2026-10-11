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

* The `Screen` header is a fixed 56 px bar and the demo banner above the navigator handles the status-bar inset
  (`_layout.tsx:15`, `ScreenHeader.tsx:55`). The clipped result title is checked on the emulator, see section 2.
* `result.tsx` and `movement.tsx` use fixed `row` layouts with fixed heights for chips (`result.tsx:104`,
  `height: 32`), which cuts wrapped Urdu text. Details in section 2.

## 2. What was changed

(Filled in per commit below.)
