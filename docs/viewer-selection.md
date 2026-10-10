# Body viewer selection

Status: draft. Nothing here is clinically reviewed. Demo only, not for real patients.

## Layers

The viewer has two layers, chosen in a small menu on the 3D body: **Muscle** (default) and **Bone**. There is no skin layer (the source model has none) and no Surface / Middle / Deep picker.

- **Muscle** shows all soft tissue of the pack (the pack calls it "superficial" and "deep"; those labels are a geometry guess, see `docs/3d-model.md`, and are not shown to the user). A tap selects the **outermost** muscle hit by the ray.
- **Bone** shows bones only. A tap selects the first bone hit by the ray.
- The picker only looks at parts of the visible layer. Changing layer clears the highlight and the selection.

## What onSelect returns

```ts
onSelect({
  regionId,       // "shoulder_right" | "shoulder_left"
  subRegionId,    // "top" | "front" | "back" | "side" | "scapular" (shoulder blade)
  point,          // {x, y, z} model space, metres, body 1.7 high (approximate if the figure or list was used)
  hitStructure,   // {meshName, name, kind} or null (figure and list have none)
  layer,          // "muscle" | "bone", always set
})
```

- `subRegionId` and `point` are what any narrowing must use. `subRegionId` comes from where the point lies relative to the shoulder joint (up = top, +z = front, -z = back, outward = side), not from the camera angle.
- **`hitStructure` is a hint, not a diagnosis.** It is the closest surface structure (muscle layer) or closest bone (bone layer) under the finger. The real source of pain can be a deeper structure, and a muscle on the surface is often not it. Do not narrow on `hitStructure` alone, and do not show it as a finding. P6 shows it as "Closest surface structure" or "Closest bone" with the note "This is where you tapped, not a diagnosis."
- Structure names are English only (not translated). TO CONFIRM how to present them in Urdu and Roman Urdu.

## Depth

The depth is no longer chosen on P6. A fixed follow-up question (PLACEHOLDER, Person C replaces it, in `src/dev/followUpQuestionsStub.json`) asks: "Does it feel just under the skin, deep inside, or are you not sure?" "Not sure" is stored as state `unknown` with value `null` and is never turned into another answer. The answer goes to the narrowing stub as `depthAnswer` (`null` if the question was not asked).

## Narrowing stub

`src/dev/narrowingStub.ts` (PLACEHOLDER, Person C replaces; outside `gate/`). Input: `layer`, `regionId`, `subRegionId`, `point`, `hitMeshName`, `depthAnswer`, `movementResults`. Output: `{ candidates: [{muscleId, confidence, reason}], cluster }` (shared/formats.md, format 4). The stub returns 1 to 3 dummy candidates (see `docs/intake-flow.md`).

## TO CONFIRM

- Shoulder joint centres and the 22 cm radius / 12 cm below-joint cut-off in `src/regions/subregion.ts` (derived from the humerus mesh, not from an anatomy reference), and the five sub-region names.
- Whether "Muscle" should include ligaments, tendons and capsules (it does now: all soft tissue).
- Wording of the depth question and its two options (clinician review).

## Modes and other body areas

The viewer is used in two modes (see `docs/intake-flow.md`): exact mode highlights only the structure under the finger, region mode highlights every structure of the tapped side and sub-region in the active layer (`src/regions/regionMap.ts`). A tap on another body area (neck, chest, upper arm, ...) shows a "Full project" message and selects nothing.
