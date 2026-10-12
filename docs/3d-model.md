# 3D body model

Status: draft. Nothing here is clinically reviewed.

## Source, author and licence

| Item | Value |
|---|---|
| Model name | Myology |
| Source | Sketchfab: https://sketchfab.com/3d-models/myology-31b40fd809b14665b93773936d67c52c (verify on source page) |
| Author | Z-Anatomy, https://sketchfab.com/Z-Anatomy (verify on source page) |
| Licence | CC BY-SA 4.0 (`CC-BY-SA-4.0` in the Sketchfab download), http://creativecommons.org/licenses/by-sa/4.0/ (verify the licence version on source page) |
| Modified? | Yes. The files in this repo are an adapted version (see below). |

Credit line, copied exactly from the `license.txt` that came with the Sketchfab download:

> This work is based on "Myology" (https://sketchfab.com/3d-models/myology-31b40fd809b14665b93773936d67c52c) by Z-Anatomy (https://sketchfab.com/Z-Anatomy) licensed under CC-BY-SA-4.0 (http://creativecommons.org/licenses/by-sa/4.0/)

Where the credit appears:
- Profile, then "About and privacy" screen (`mobile/src/app/about.tsx`, text in `mobile/src/i18n/credit.ts`, shown unchanged in every language)
- `README.md`
- this file

The `license.txt` itself stays on the developer's disk with the original model (`mobile/assets/models/`, not committed).

## What is committed

| File | Size | SHA-256 |
|---|---|---|
| `mobile/assets/models/pack/body-lite.bin` | 39,219,784 bytes (37.4 MiB) | `1147afea2ccc663d0d0fe1df1a41abb58bf4a31959726d24d70ba92bd23125cd` |
| `mobile/assets/models/pack/body-lite.json` | 313,165 bytes | `439052718a24d0f751a240ff75c56f54d81120f10c2563d7d81fd9f38f432083` |

Only the lite pack is committed. The original GLB/OBJ/scene files, the quantized GLB and the full (undecimated) pack stay on local disks and are git-ignored.

## How the lite pack was made (adapted version)

`mobile/scripts/build-model-pack.mjs lite` turns the original `model.glb` into the pack. Settings, as in the script:

| Step | Setting |
|---|---|
| Source | 1,610 meshes, 5,711,831 triangles (original `model.glb`, 128.7 MB) |
| Decimation | meshoptimizer `simplify`, border locked. Meshes of 600 triangles or fewer are kept as they are (638 meshes). The other 972 are reduced to a target ratio of 0.2 of their triangles (bones 0.25, rotator cuff 0.6), never below 600 triangles. Error bound 0.02 (rotator cuff 0.004). |
| Merge | All meshes with the same layer and region are merged into one mesh: 46 parts, so 46 draw calls. The pack keeps a triangle range per source mesh so taps still resolve to the original mesh name. |
| Quantization | Positions int16 (per-part normalised), normals int8, colours uint8. |
| Result | 1,711,830 triangles, 1,556,472 vertices (30% of the original triangles) |
| Layers | bone (14 parts), superficial (17), deep (15). No skin layer: the source has no skin mesh. |

Checked on 2026-10-10: running the script in `lite` mode again on the same inputs gave files with exactly the same SHA-256 values as above (same vCount, iCount and byte size).

## Share-alike (what it means for our files)

CC BY-SA 4.0 lets us copy and adapt the model, including commercially, if we:
1. Give credit (the credit line above), link the licence, and say the work was changed.
2. Release the adapted material under the same licence (or a compatible one).

Our adapted files, `body-lite.bin` and `body-lite.json` (decimated, merged, quantized), are therefore also CC BY-SA 4.0 and must carry the credit when shared. The About screen states that the 3D body is a simplified version under the same licence.

The ShifaKinetix app code that only loads the pack is a separate work. This reading is not legal advice. TO CONFIRM with the supervisor or the university whether anything more is needed for the report or the demo.

## Rebuild steps

Inputs (not in the repo, kept on the developer's disk):
- `mobile/assets/models/model.glb` (original, 128.7 MB)
- `mobile/_web_reference/regionMap.json` (mesh name to region map)

```
cd mobile
npm ci
node scripts/build-model-pack.mjs lite     # writes assets/models/pack/body-lite.bin and .json
node scripts/build-model-pack.mjs full     # optional, no decimation, stays local
node scripts/check-model-names.cjs         # optional report: GLB names vs regionMap.json
```

Output folder: `mobile/assets/models/pack/`. Time taken: about 8 seconds for `lite` on the developer's laptop (2026-10-10). Setting `EXPOSED_FRACTION` (default 0.5) changes the layer split. Rebuilding changes the SHA-256 values above only if inputs or settings change.

## Layer labels are a guess

The "superficial" and "deep" labels come from a geometry test, not from anatomy: a mesh counts as superficial if a straight horizontal line from at least half of its sampled vertices reaches the outside without hitting another mesh. Known error: the rhomboids came out superficial although they are deep muscles. Bones come from material names. The shoulder region for a tap comes from the model's own region map plus the side (mesh name suffix) and how the model was turned. None of this has been reviewed by a clinician. Do not show layer or muscle names to patients as facts.

## TO CONFIRM

- Licence version (4.0), author and URL: verify on the Sketchfab page.
- Whether Z-Anatomy asks for additional upstream credits (its model is, to our knowledge, derived from other open anatomy data). Check the source page and the author's profile.
- Whether the `license.txt` we have matches the licence on the page today.
- Whether the university needs anything beyond the credit line for the report and the demo.
