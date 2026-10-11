# Movement animation on the real 3D body

> **Update (branch `feature/B-movement-ux-fixes`)**: parts of this report are out of date. The movement view now has orbit and zoom,
> per-movement camera presets, the same opaque material as the body picker (the dimming of non-suggested muscles is gone), a left-arm
> rig, a redesigned hand behind back, and loops of 4.5 to 9 s (out, hold, slower return). See `docs/movement-ux-findings.md`.
> The frame-rate numbers below are from the earlier build.

Status: **draft**. All angles are **test values, replace with researched data** (Appendix A of the brief, kept in
`mobile/src/data/movements_shoulder.json`, labelled "draft, awaiting clinician review"). Nothing here is clinical advice.
Nothing has been pushed. The 3D pack files are unchanged (SHA-256 checked at the end, see "Pack unchanged").

## 1. What was built

The six shoulder movements now play on the real lite 3D body (the same pack as the body picker and the result screen).
The arm is moved as rigid segments about computed pivots, driven by keyframes. The old 2D mannequin is only a fallback and
is then marked **"Simplified diagram"**.

| Piece | File |
| --- | --- |
| Movement data (test values) | `mobile/src/data/movements_shoulder.json`, typed in `src/movement/movements.ts` |
| Pose over time (ease, holds, ~4 s loop) | `src/movement/pose.ts` |
| Rig maths (axes, pivots, hierarchy) | `src/movement/rig.ts`, data in `src/data/arm_rig.json` (made by `scripts/build-arm-rig.mjs`) |
| Splitting meshes into segments (index subsets, shared vertex buffers) | `src/movement/split.ts` |
| Animated body | `src/components/body3d/SegmentedBody.tsx` |
| Patient stage with fallback | `src/components/movement/MovementStage.tsx`, `MovementPlayer.tsx` (mannequin) |
| Dev test screen (needs `EXPO_PUBLIC_DEV_ANIM=1`) | `src/app/dev/anim.tsx` |
| Emulator capture | `scripts/audit/capture-anim.py` |

## 2. Feasibility (Step 1 result)

Splitting was possible **without rebuilding the pack**. The pack stores merged parts, each with its own triangle and vertex
range and no vertex shared with another part (`meshesSharingVerticesWithOthers: 0`, ranges contiguous). A segment is
therefore a subset of a part's index list over the same vertex buffers; the pack bytes are not touched.

Segments of the right arm (whole meshes assigned by distance rules, each with a recorded reason in `arm_rig.json`):

| Segment | Meshes | Moves with |
| --- | --- | --- |
| girdle (clavicle, scapula, their muscles) | 19 | scapula rule, about the sternoclavicular pivot |
| upper arm | 28 | elevation, plane, rotation, about the humeral head |
| forearm (+ hand, 130 meshes) | 51 + 130 | elbow flexion, about the elbow |
| trunk, whole left arm | rest | never moves (tested) |

Cost of the split: 113,666 triangles move; about 10.4 MB extra index memory; about **+5 draw calls (Bone) and +18 draw calls
(Muscle)**.

Known limit of whole-mesh assignment: muscles that span the trunk and the arm (for example the pectoral muscles, latissimus)
are assigned to one side, so their far end **tears away or stays put** as the arm moves. This is the "rigid segments"
trade-off asked for; a smooth skin or a per-vertex weight pass would be the next step.

## 3. Pivots, axes and sign conventions

World axes: **+x is the patient's left, +y up, +z forward**; units metres. The right shoulder is on the negative x side.
Pivots (computed from the mesh, not typed in):

| Pivot | How | Value (m) |
| --- | --- | --- |
| Humeral head centre | sphere fit to 313 head vertices (rms 1.4 mm) | (-0.1691, 1.3819, -0.0263), radius 23.4 mm |
| Glenoid | labrum centroid | (-0.1498, 1.3777, -0.0359) |
| Elbow | between distal humerus and proximal ulna (12.8 mm apart) | (-0.2214, 1.1033, -0.0333) |
| Sternoclavicular | medial clavicle | (-0.0176, 1.4009, 0.0365) |

Hierarchy: girdle (about SC, scapular plane) → upper arm (about the head: elevation axis × rotation about the rest axis) →
forearm (about the elbow, epicondylar axis, positive = flexes forward).

Angles: elevation 0 = the model's own rest pose (which is about **10.6 degrees abducted**, not 0); positive elevation raises,
**negative elevation is backward**; plane 0 = sideways, 90 = forward; **positive rotation = external**; elbow 0 = straight.
Scapula follows the rule: `(elevation - 30) / 3` above 30 degrees, else 0.

## 4. Tests (Step 3)

`npm test -- --ci`: **11 suites, 132 tests pass**; `npx tsc --noEmit` clean.

- a. Movement data: every movement has frames, labels, allowed ranges, keyframe times, loop; values labelled as test values.
- b. Pose function: seamless loop, holds exactly still, peak reached.
- c. Smoothness at 60 Hz (limits in the test file): speed <= 90 deg/s, acceleration <= 800 deg/s^2 (scapula 1600), jump <= 2 deg per frame.
  Observed, sideways raise: max jump 1.31 deg/frame, 78.4 deg/s; can-position hold (5 s loop) 84.7 deg/s; outward push 23.5 deg/s;
  belly press 52.9 deg/s; hand behind back 84.0 deg/s.
- d. Rig: axes, pivots, segment assignment, trunk and left arm never move, girdle moves only through the scapula rule, forearm follows the arm, sign conventions.
- e. Joint gap: the head-to-glenoid distance is 22.0 mm at rest and changes by **0.000000 mm** over every pose (tolerance 1 mm).
- f. Splitting: every triangle ends in exactly one piece; real-pack checks (113,666 moved triangles, labrum vertices) skip if the pack is absent.
- The safe gate: every screen after the gate is wrapped in `SafeGuard` (source check in `intakeFlow.test.tsx`).

## 5. Emulator results (Step 4)

Pixel 7 emulator, Expo Go, **software GL** (no GPU). The emulator is **not a phone**: do not read these numbers as phone numbers.

| Movement | Muscle fps mean (min) | Bone fps mean (min) |
| --- | --- | --- |
| Raise sideways | 25.2 (24) | 23.5 (15) |
| Raise forward | 24.2 (17) | 24.5 (24) |
| Can position hold | 23.8 (18) | 23.8 (20) |
| Outward push, elbow at side | 24.6 (22) | 22.0 (17) |
| Belly press | 22.2 (15) | 22.8 (19) |
| Hand behind back | 23.2 (21) | 25.8 (24) |

fps is the number the dev screen measures (`fps.json` has the samples). `dumpsys gfxinfo` reports **57 to 68 % janky frames**,
which is what a 60 Hz display shows when rendering manages about 24 fps; it says the emulator is slow, not that single frames
hitch. A real phone must be checked (section 7).

Screenshots: `docs/model-audit/animation/<movement>-<muscle|bone>-<rest|p25|peak|p75>.png`
(6 movements x 2 layers x 4 phases = 48 files, each below 200 KB, folder 6.4 MB) plus two flow screenshots
(`flow-1-movement-3d.png`, `flow-2-movement-simplified-fallback.png`).

### What the screenshots show (my judgement from images, not a measurement)

- The raised arm stays attached at the shoulder in every pose; the humeral head stays on the glenoid (gap constant, 22.0 mm).
- Sideways, forward and can-position poses look natural: arm lifts, shoulder blade tilts, no flipped parts.
- Highlighted structure (cyan) follows the arm; other muscles are dimmed (not hidden); the resist arrow points where expected.
- **Visible artefacts:**
  1. Muscles that cross trunk and arm (pectoral/latissimus) are cut at the segment boundary and drift with the arm (see "limits").
  2. Belly press: the forearm lies across the lower ribs and the hand overlaps the rib cage; it may intersect the bones. Check on a phone.
  3. Hand behind back (side view): the forearm goes behind the body and is hidden by the rib cage in the front view; near the lower
     back it likely passes through the ribs/pelvis. Check on a phone from side and front.
  4. At the peak of the sideways raise (120 degrees) the fingertips touch the top edge of the frame at the default camera.

## 6. Failure handling and flow

- `EXPO_PUBLIC_DISABLE_3D=1`: the body picker shows "3D view unavailable, choose from the list" and the movement screen shows the
  mannequin with **"Simplified diagram"**; the flow continues (fork, point, basics, red flags, SAFE, movements). Tested on the emulator.
- 3D models crash or load too slowly: `Boundary` plus a 25 s load timeout switch to the same fallback (not forced on the emulator,
  not unit-tested).
- "Model renamed" test: the pack is a bundled asset, so removing the file makes the **bundler** fail at build time, not at run
  time. I did not rename it; the run-time failure path is covered by the DISABLE_3D test above.
- Normal flow with 3D on: fork, region mode, body list, basics, three red-flag questions, SAFE, six movements (3D animation,
  caution strip on every one), "What did you feel?", three follow-up questions, result ("Muscles that may be involved") all work.
- While testing the fallback I found and fixed two console errors in the older mannequin (an easing option the native driver rejects,
  and a stray space between elements). Both gone (0 errors in the Metro log on the fallback path). The mannequin now moves linearly
  between keyframes (no sine easing).

## 7. Limits

- Emulator frame rates are software-rendered, not phone numbers.
- Judging artefacts from screenshots is judgement. The user must look on a phone.
- Rigid segments only: muscles that span two segments tear at the boundary; no skin deformation.
- The scapula rule has a velocity kink at 30 degrees elevation (scapula acceleration up to 1490 deg/s^2, allowed up to 1600 in the test).
- Can position hold needs a **5 s** loop to stay under 90 deg/s (the other movements use 4 s).
- Appendix A `hand_behind_back` allows elbow 80 to 110 degrees but the rest elbow is 0; recorded in the test as a known conflict.
- The sources listed in the data do not support the numbers (see `sourcesNote`); the numbers are test values.
- Development builds print a three.js warning ("THREE.Clock deprecated") from the library; it is a development-build warning only.

## 8. What the user must check on a phone

1. Frame rate and smoothness of each movement, both layers (open the dev screen with `EXPO_PUBLIC_DEV_ANIM=1`, route `/dev/anim`; the fps readout is on screen).
2. Belly press and hand behind back for arm-through-body, and the cropped fingertips at the top for the sideways raise.
3. Front/side camera switch, 0.25x/0.5x/1x speeds, scrubber, play/pause.
4. Memory and heat after 5 minutes of looping (about 10 MB extra index memory plus the pack itself).

## 9. What a physiotherapist must confirm (TO CONFIRM)

- Every angle in the six movements (peak elevation, plane, rotation, elbow) and the hold times.
- The scapula rule, and that "elevation 0" should mean the arm hanging (the model rests about 10.6 degrees abducted).
- Which muscle "suggests" for each movement, and the resist arrows.
- The hand-behind-back elbow range (80 to 110 degrees in the appendix versus a straight rest elbow).
- Caution wording on the movement screens (kept as is).

## Pack unchanged

`body-lite.bin` 1147afea2ccc663d0d0fe1df1a41abb58bf4a31959726d24d70ba92bd23125cd,
`body-lite.json` 439052718a24d0f751a240ff75c56f54d81120f10c2563d7d81fd9f38f432083 (both identical to before).
