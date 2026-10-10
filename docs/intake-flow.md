# Symptom-intake flow (Person B)

Status: draft. Nothing here is clinically reviewed. Demo only, not for real patients.

## Order of screens

```
Home -> intro (P4) -> fork -> body (P5) -> confirm (P6) -> basics (P27) -> red-flag questions -> gate stub
                                                                                  |
        RED_FLAG -> urgent screen (flow stops)                                    |
        CLARIFY  -> re-ask once -> gate again -> still CLARIFY -> "see a doctor" (flow stops)
        SAFE     -> safe screen
                    exact mode  -> follow-up questions -> result (P13) -> choice (P13b)
                    region mode -> 6 movements (try + "what did you feel") -> follow-up questions -> result -> choice
```

- **Fork** ("Can you point to the exact spot?"): "Yes, I can point exactly" is **exact mode**. "No, my whole shoulder hurts" and "Not sure" are **region mode**. "Not sure" is stored as an answer with state `unknown` (`Q_FORK_POINT`).
- **P5 body:** exact mode highlights only the structure under the finger (all meshes of that one structure). Region mode highlights the whole tapped area: every structure of that side and sub-region in the active layer (Muscle or Bone). A tap on another body area (neck, chest, upper arm, ...) shows a "Full project" message and selects nothing.
- **P6 confirm:** "Right shoulder, back" (side and sub-region) and a small line "Closest surface structure: <name>" or "Closest bone: <name>". The depth choice (Surface / Middle / Deep) is gone: the fixed follow-up question "Does it feel just under the skin, deep inside, or are you not sure?" replaces it.
- **Gate:** movements, follow-up questions, narrowing and the result are reachable **only after the verdict SAFE**. Every such screen is wrapped in `SafeGuard`; `runNarrowing()` returns `null` for any other verdict. The rules are in `mobile/src/flow/intake.ts` and tested.
- **Result:** "Muscles that may be involved. Not a diagnosis. Estimate", highlighted on the 3D body. Low confidence (under 0.5) or a cluster adds the suggestion to see a doctor. Then the choice screen: "Talk to a doctor" or "Get advice from the AI assistant" (both are stubs).

## Region map

`mobile/scripts/build-region-map.mjs` reads the structure names in `body-lite.json` and writes `shared/regions_shoulder.json` (region, sub-region, structure) and `docs/region-map-report.md`. Rules are name rules only (textbook location from the name), not geometry. A structure can belong to several sub-regions. Shoulder-area structures with no rule are listed under `unmapped` in the JSON and in the report; nothing is dropped. Sub-regions: top, front, side, back, shoulder blade (`scapular`). Every item says "draft, awaiting clinician review". Urdu and Roman Urdu labels need a native speaker's review. Rebuild: `cd mobile && node scripts/build-region-map.mjs`.

The sub-region of a tap (`subRegionId`) is worked out from the tapped point relative to the shoulder joint (`src/regions/subregion.ts`), and used for the P6 label and for region-mode highlighting through the map.

## Movements

`mobile/src/data/movements_shoulder.json`: six movements (sideways raise, forward raise, can-position hold, outward push with elbow at side, belly press, hand-behind-back reach). Each has keyframes (start, peak, return; upper-arm angle, elbow, shoulder-blade rotation), instructions in English, Urdu and Roman Urdu, the caution line "Move only as far as comfortable. Stop if pain is sharp or severe.", `cameraMeasurable` (true only for the two raises), a source list and the label "draft, awaiting clinician review".

- Sources are only: Michener 2009, Park 2005, Kelly 1996, Gerber 1991, Hegedus 2012, AAOS range norms. **Which source belongs to which movement is my assignment from memory and must be confirmed by a physiotherapist.** No page numbers or findings are quoted.
- All angles are "typical value, confirm with physio", for a gentle demo, not norms and not limits. The animation never passes the demo limits in `COMFORT_LIMITS`.
- The shoulder blade turns about one third of the arm elevation after the first 30 degrees: `scapulaDeg = (humerusDeg - 30) / 3` above 30 degrees, else 0 (typical value, confirm with physio).
- Result per movement, agreed format: `{movementId, painful, weak, unableToDo, measuredAngle|null, state}`. "Not sure" and "Skip" give `state: "unknown"` (the booleans are false only because there is no answer; read `state` first). The camera result is a placeholder: "Camera measurement is part of the full project", `measuredAngle` stays `null`.

### Why a separate mannequin

The lite pack has `upper_arm` and `forearm_wrist` as groups, but each group is one merged mesh per layer that holds both the left and the right side and every muscle of that region, with no joints. One arm cannot be rotated without rebuilding the pack, which was not allowed. The demo is drawn on a simple capsule mannequin with pivots (`components/movement/MovementPlayer.tsx`), driven by the keyframes. It is schematic: the outward push and the hand-behind-back poses are simplified in 2D and a physio should check them.

## Placeholders for Person C

- `mobile/src/dev/narrowingStub.ts`: dummy narrowing, `narrow(input)`. Input: layer, regionId, subRegionId, point, hitMeshName, depthAnswer, movementResults. Output: `{candidates: [{muscleId, confidence, reason}], cluster}` with 1 to 3 candidates. Scores come from a fixed hash, not from medicine; confidence drops 10% per unknown answer (at most 50%); a cluster is returned when the top two tie (within 0.02). It claims nothing beyond "may be involved". To replace it, change `narrow()` or the import in `src/flow/intake.ts`.
- `mobile/src/dev/followUpQuestionsStub.json`: three fixed follow-up questions, including the depth question. "Not sure" is stored as `unknown`.
- Symptom basics (P27) and the red-flag questions (`shared/questions_shoulder.json`, Person A) are also placeholders.

## Not done

Camera measurement, the real narrowing, real follow-up questions, doctor chat, the AI assistant, booking, other body regions (neck, chest, upper arm, ...).
