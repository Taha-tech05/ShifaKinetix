# Lite model audit

Date: 2026-10-10. Branch: `feature/B-model-lite`. This was a read-only audit: `body-lite.bin`, `body-lite.json` and the original `model.glb` were not changed, rebuilt or regenerated (SHA-256 of the pack files still match `docs/3d-model.md`).

Layer labels (superficial or deep) are a geometry guess, not anatomy. Rhomboids came out superficial although they are deep muscles. Nothing in this audit is a clinical review.

## Summary

| Part | What was checked | Result |
|---|---|---|
| 1 Inventory | Every mesh and structure name, original vs lite | **PASS**. Nothing missing, nothing extra |
| 2 Detail loss | Triangles, bounding box, shape error, area and volume per structure | **WARN** (348) and **FAIL** (50) by the rules you set, but no real loss found (see below) |
| 3 Picking parity | 1,760 rays through the app's own picker, both models | **PASS**. 99.5% same first hit; no shoulder muscle missed |
| 4 Visual and emulator | 16 same-camera pairs, 8 layer views, emulator run | **PASS with notes**. Smoother surface, no holes or lost parts seen. Judgement from screenshots only |

### Totals

- Original: 1,610 meshes, 1,074 structures (an anatomical item plus its side; sub-meshes such as `_1`/`_2` are pooled). Lite: 1,610 meshes, 1,074 structures.
- Structures by type (pack layer): 293 bone, 781 soft tissue (muscles, tendons, ligaments, capsules and others). The model does not label muscles separately, so the audit counts all structures.
- Missing in lite: **0**. Extra in lite: **0**. Duplicate names: 0. Triangle ranges consistent: yes.
- Triangles: 5,711,831 original, 1,711,830 lite (30%).
- Part 2: PASS 676, **WARN 348**, **FAIL 50** (rule results; explained below).
- Shoulder (59 structures): PASS 19, WARN 40, FAIL 0. Worst surface error 1.26 mm. Worst bounding-box change 1.5% of length.

## Method

All scripts are in `mobile/scripts/audit/`. They only read the models.

1. **Inventory** (`part1-inventory.mjs`): load `model.glb` with three's GLTFLoader (world transforms baked, as the pack builder does) and the pack with its triangle-to-mesh ranges (the same map the picker uses). Compare names, structures, and a named shoulder checklist.
2. **Detail loss** (`part2-detail.mjs`, `part2-report.mjs`): per structure (sub-meshes pooled): triangle counts; bounding box over used vertices; shape error = 200 random points per original mesh (area-weighted) to the nearest point on the lite surface of the same structure (point-to-triangle distance), reported as a percentage of the structure's longest dimension and in millimetres (model units are assumed to be metres: the body is 1.70 units tall); surface area; volume from the divergence theorem.
3. **Picking parity** (`part3-picking.mjs`): the app's own `pick.ts` (transpiled, not copied) on the lite pack and on the original (each original mesh as one part, quantised to int16 in its own box, error under 1/32767 of its size). Same rays for both: 500 random rays (seed 777) and 20 rays per shoulder structure (63 structures, 1,260 rays) aimed at the centre of its bounding box, 10 from the front and 10 from the back within 50 degrees.
4. **Visual** (`render-server.mjs`, `render.html`, `part4-tappable.mjs`): headless Edge with software WebGL renders both models with three.js using the same camera, lights and material as the app. Each muscle is shown alone with the clavicle, scapula and humerus of the same side. The Pixel 7 emulator (Android 16, Expo Go 57.0.9) ran the real app with the lite pack.

## Part 1: Inventory

Result: **PASS**. All 1,610 original meshes and all 1,074 structures exist in lite with identical names. The pack merges meshes into 46 parts (one draw call per layer and region), but each mesh keeps its own triangle range, so no mesh lost its identity and none was merged into another by name.

Shoulder checklist (real names in the model; `part1-shoulder-checks.csv` has every mesh name):

| Item | Meshes original / lite | Status |
|---|---|---|
| Supraspinatus | 2 / 2 | found |
| Infraspinatus | 4 / 4 | found |
| Teres minor | 2 / 2 | found |
| Teres major | 2 / 2 | found |
| Subscapularis (named "Subscapular muscle") | 2 / 2 | found |
| Deltoid, clavicular part (anterior) | 4 / 4 | found |
| Deltoid, acromial part (middle) | 4 / 4 | found |
| Deltoid, scapular part (posterior; typo "Scapular part of deltoid uscle" in the model) | 4 / 4 | found |
| Trapezius: descending / transverse / ascending parts | 4 / 4 each | found |
| Levator scapulae | 4 / 4 | found |
| Rhomboid major, rhomboid minor | 4 / 4 each | found |
| Biceps brachii: long head (two sets of meshes), short head, "medial head" | 8 (two sets), 4, 4 / same | found |
| Triceps brachii | 4 / 4 | found, **only the lateral head exists in the original** |
| Pectoralis major: clavicular head, sternocostal head, abdominal part | 4 / 4 each | found |
| Pectoralis minor | 2 / 2 | found |
| Latissimus dorsi | 12 / 12 | found |
| Clavicle, scapula, humerus | 4, 8, 4 / same | found |
| Acromion as a separate mesh | 0 / 0 | **not in the original** (part of the scapula mesh) |

Other shoulder-related structures that were not on your list (55, all present in lite): acromioclavicular, glenohumeral and sternoclavicular ligaments, capsules and discs, coraco-acromial and coracohumeral ligaments, glenoid labrum, transverse scapular and humeral ligaments, serratus anterior, coracobrachialis, brachialis, omohyoid and others. See `part1-summary.json`.

## Part 2: Per-structure detail loss

Per-structure data: `per-muscle.csv` (1,074 rows, includes bounding-box sizes, area and volume).

### Part 2 totals

Structures compared: 1074. PASS 676, WARN 348, FAIL 50.

Reasons (a structure can have several):

- kept<30%: 347
- lite<50 tris: 48
- maxErr>2%: 3
- bbox>5%: 2

FAIL for "lite < 50 triangles" where the original was also under 50 triangles (nothing was lost by the pack): 48.
FAIL rows that are NOT explained by that: 2.

### FAIL rows not explained by tiny originals

| Structure | Type | Tris orig | Tris lite | Kept % | BBox change % of longest | Mean err % | Max err % | Max err mm | Area change % | Volume change % | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Sclera L Grp1 | superficial | 39524 | 7904 | 20.0 | 64.85 | 0.018 | 0.056 | 0.0 | -0.1 | -0.3 | FAIL (bbox>5%; kept<30%) |
| Sclera R Grp1 | superficial | 39524 | 7900 | 20.0 | 64.85 | 0.014 | 0.041 | 0.0 | -0.1 | -0.2 | FAIL (bbox>5%; kept<30%) |

### 10 lowest percentage of triangles kept (structures with at least 100 original triangles)

| Structure | Type | Tris orig | Tris lite | Kept % | BBox change % of longest | Mean err % | Max err % | Max err mm | Area change % | Volume change % | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Radiate Ligament Of Head Of Rib (Right) | deep | 3456 | 684 | 19.8 | 0.02 | 0.023 | 0.087 | 0.3 | -1.1 | -6.6 | WARN (kept<30%) |
| Ascending Part Of Trapezius Muscle (Right) | superficial | 9194 | 1834 | 19.9 | 0.37 | 0.087 | 0.447 | 0.7 | -0.4 | -0.1 | WARN (kept<30%) |
| Calcaneal Tendon (Left) | superficial | 9120 | 1816 | 19.9 | 0.17 | 0.030 | 0.152 | 0.3 | -0.5 | -0.9 | WARN (kept<30%) |
| Extensor Digitorum Longus (Right) | superficial | 11920 | 2374 | 19.9 | 0.16 | 0.019 | 0.109 | 0.4 | -0.5 | -1.3 | WARN (kept<30%) |
| External Intercostal Muscles (Right) | deep | 87127 | 17369 | 19.9 | 0.01 | 0.026 | 0.112 | 0.4 | -1.0 | 0.3 | WARN (kept<30%) |
| Fibularis Longus (Left) | superficial | 11046 | 2202 | 19.9 | 0.10 | 0.018 | 0.097 | 0.4 | -0.5 | -0.7 | WARN (kept<30%) |
| Longissimus Capitis (Left) | superficial | 3148 | 628 | 19.9 | 0.11 | 0.052 | 0.244 | 0.4 | -0.3 | -1.1 | WARN (kept<30%) |
| Longissimus Capitis (Right) | superficial | 3148 | 628 | 19.9 | 0.15 | 0.051 | 0.191 | 0.3 | -0.7 | -1.2 | WARN (kept<30%) |
| Longus Capitis Muscle (Left) | deep | 3960 | 790 | 19.9 | 0.11 | 0.045 | 0.204 | 0.2 | -0.8 | -0.7 | WARN (kept<30%) |
| Occipitalis (Left) | superficial | 5204 | 1038 | 19.9 | 0.52 | 0.116 | 0.462 | 0.2 | -0.7 | -2.0 | WARN (kept<30%) |

### 10 highest max shape error

| Structure | Type | Tris orig | Tris lite | Kept % | BBox change % of longest | Mean err % | Max err % | Max err mm | Area change % | Volume change % | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Costal Cartilages (Right) | bone | 58128 | 19550 | 33.6 | 1.08 | 0.645 | 2.514 | 8.4 | -12.8 | -63.3 | WARN (maxErr>2%) |
| Costal Cartilages (Left) | bone | 10158 | 3300 | 32.5 | 0.98 | 0.596 | 2.261 | 7.6 | -17.6 | -59.8 | WARN (maxErr>2%) |
| Longus Colli Muscle (Right) | deep | 12590 | 9122 | 72.5 | 1.34 | 0.255 | 2.120 | 3.3 | -11.9 | -26.7 | WARN (maxErr>2%) |
| Longus Colli Muscle (Left) | deep | 12590 | 9120 | 72.4 | 1.35 | 0.232 | 1.885 | 3.0 | -13.6 | -26.5 | PASS |
| Occipital Bone | bone | 6648 | 1798 | 27.0 | 0.13 | 0.313 | 1.680 | 2.0 | -0.6 | -1.4 | WARN (kept<30%) |
| Coccygeus Muscle (Left) | deep | 2070 | 600 | 29.0 | 0.29 | 0.125 | 1.492 | 0.7 | 0.1 | -0.2 | WARN (kept<30%) |
| Frontal Bone | bone | 9194 | 2230 | 24.3 | 0.36 | 0.186 | 1.448 | 1.8 | -1.2 | 1.6 | WARN (kept<30%) |
| Ethmoid Bone | bone | 4064 | 1016 | 25.0 | 0.49 | 0.264 | 1.383 | 0.6 | 0.1 | -0.7 | WARN (kept<30%) |
| Articular Capsule Of Knee Joint (Right) | superficial | 2944 | 600 | 20.4 | 0.71 | 0.331 | 1.347 | 1.2 | -1.6 | -1.7 | WARN (kept<30%) |
| Articular Capsule Of Knee Joint (Left) | superficial | 2944 | 600 | 20.4 | 0.71 | 0.366 | 1.281 | 1.1 | -1.5 | -1.9 | WARN (kept<30%) |

### 10 highest mean shape error

| Structure | Type | Tris orig | Tris lite | Kept % | BBox change % of longest | Mean err % | Max err % | Max err mm | Area change % | Volume change % | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Costal Cartilages (Right) | bone | 58128 | 19550 | 33.6 | 1.08 | 0.645 | 2.514 | 8.4 | -12.8 | -63.3 | WARN (maxErr>2%) |
| Costal Cartilages (Left) | bone | 10158 | 3300 | 32.5 | 0.98 | 0.596 | 2.261 | 7.6 | -17.6 | -59.8 | WARN (maxErr>2%) |
| Articular Capsule Of Knee Joint (Left) | superficial | 2944 | 600 | 20.4 | 0.71 | 0.366 | 1.281 | 1.1 | -1.5 | -1.9 | WARN (kept<30%) |
| Articular Capsule Of Knee Joint (Right) | superficial | 2944 | 600 | 20.4 | 0.71 | 0.331 | 1.347 | 1.2 | -1.6 | -1.7 | WARN (kept<30%) |
| Occipital Bone | bone | 6648 | 1798 | 27.0 | 0.13 | 0.313 | 1.680 | 2.0 | -0.6 | -1.4 | WARN (kept<30%) |
| Articular Capsules Of Metatarsophalangeal Joints (Left) | deep | 1752 | 600 | 34.2 | 0.50 | 0.289 | 1.159 | 0.9 | -3.2 | -7.6 | PASS |
| Articular Capsules Of Metatarsophalangeal Joints (Right) | deep | 1752 | 600 | 34.2 | 0.62 | 0.286 | 0.854 | 0.7 | -3.3 | -7.8 | PASS |
| Articular Capsule Of Elbow (Right) | superficial | 1728 | 600 | 34.7 | 0.69 | 0.267 | 1.147 | 0.7 | -1.1 | -11.5 | PASS |
| Ethmoid Bone | bone | 4064 | 1016 | 25.0 | 0.49 | 0.264 | 1.383 | 0.6 | 0.1 | -0.7 | WARN (kept<30%) |
| Longus Colli Muscle (Right) | deep | 12590 | 9122 | 72.5 | 1.34 | 0.255 | 2.120 | 3.3 | -11.9 | -26.7 | WARN (maxErr>2%) |

### Shoulder structures (59)

| Structure | Type | Tris orig | Tris lite | Kept % | BBox change % of longest | Mean err % | Max err % | Max err mm | Area change % | Volume change % | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Abdominal Part Of Pectoralis Major Muscle (Left) | superficial | 1508 | 1198 | 79.4 | 0.00 | 0.007 | 0.109 | 0.2 | 0.1 | -0.1 | PASS |
| Abdominal Part Of Pectoralis Major Muscle (Right) | superficial | 1508 | 1198 | 79.4 | 0.00 | 0.005 | 0.080 | 0.1 | 0.1 | -0.1 | PASS |
| Acromial Part Of Deltoid Muscle (Left) | superficial | 5930 | 1388 | 23.4 | 0.05 | 0.041 | 0.422 | 0.6 | -0.8 | -0.9 | WARN (kept<30%) |
| Acromial Part Of Deltoid Muscle (Right) | superficial | 5930 | 1388 | 23.4 | 0.05 | 0.042 | 0.439 | 0.6 | -0.8 | -0.9 | WARN (kept<30%) |
| Ascending Part Of Trapezius Muscle (Left) | superficial | 9194 | 1836 | 20.0 | 0.37 | 0.092 | 0.385 | 0.6 | -0.4 | -0.2 | WARN (kept<30%) |
| Ascending Part Of Trapezius Muscle (Right) | superficial | 9194 | 1834 | 19.9 | 0.37 | 0.087 | 0.447 | 0.7 | -0.4 | -0.1 | WARN (kept<30%) |
| Clavicle (Left) | bone | 1548 | 842 | 54.4 | 0.04 | 0.021 | 0.238 | 0.3 | -0.2 | -0.9 | PASS |
| Clavicle (Right) | bone | 1548 | 842 | 54.4 | 0.04 | 0.014 | 0.200 | 0.3 | -0.0 | -0.7 | PASS |
| Clavicular Head Of Pectoralis Major Muscle (Left) | superficial+deep | 1700 | 876 | 51.5 | 0.00 | 0.018 | 0.273 | 0.5 | -0.1 | -0.2 | PASS |
| Clavicular Head Of Pectoralis Major Muscle (Right) | superficial | 1700 | 878 | 51.6 | 0.00 | 0.019 | 0.233 | 0.4 | -0.0 | -0.3 | PASS |
| Clavicular Part Of Deltoid Muscle (Left) | superficial | 5806 | 1388 | 23.9 | 0.24 | 0.037 | 0.303 | 0.5 | -0.8 | -0.7 | WARN (kept<30%) |
| Clavicular Part Of Deltoid Muscle (Right) | superficial | 5806 | 1388 | 23.9 | 0.17 | 0.040 | 0.419 | 0.7 | -0.8 | -0.6 | WARN (kept<30%) |
| Coracobrachialis Muscle (Left) | deep+superficial | 2322 | 1198 | 51.6 | 0.02 | 0.014 | 0.140 | 0.2 | 0.1 | -0.3 | PASS |
| Coracobrachialis Muscle (Right) | deep | 2322 | 1198 | 51.6 | 0.02 | 0.014 | 0.181 | 0.3 | 0.1 | -0.4 | PASS |
| Descending Part Of Trapezius Muscle (Left) | superficial | 13522 | 2702 | 20.0 | 0.11 | 0.048 | 0.204 | 0.6 | -1.0 | -0.7 | WARN (kept<30%) |
| Descending Part Of Trapezius Muscle (Right) | superficial | 13522 | 2698 | 20.0 | 0.11 | 0.045 | 0.225 | 0.7 | -0.8 | -0.5 | WARN (kept<30%) |
| Humerus (Left) | bone | 4280 | 1468 | 34.3 | 0.06 | 0.024 | 0.252 | 0.8 | 0.1 | -0.9 | PASS |
| Humerus (Right) | bone | 4280 | 1468 | 34.3 | 0.06 | 0.024 | 0.207 | 0.7 | 0.0 | -0.9 | PASS |
| Infraspinatus Muscle (Left) | superficial | 6334 | 3800 | 60.0 | 0.02 | 0.011 | 0.108 | 0.1 | 0.1 | -0.1 | PASS |
| Infraspinatus Muscle (Right) | superficial+deep | 6334 | 3800 | 60.0 | 0.02 | 0.011 | 0.109 | 0.1 | 0.1 | -0.0 | PASS |
| Lateral Head Of Triceps Brachii Muscle (Left) | superficial | 7258 | 1748 | 24.1 | 0.10 | 0.032 | 0.174 | 0.5 | -0.8 | -0.3 | WARN (kept<30%) |
| Lateral Head Of Triceps Brachii Muscle (Right) | superficial | 7258 | 1748 | 24.1 | 0.10 | 0.031 | 0.237 | 0.6 | -0.6 | -0.3 | WARN (kept<30%) |
| Latissimus Dorsi Muscle (Left) | superficial | 55610 | 11118 | 20.0 | 0.09 | 0.025 | 0.152 | 0.6 | -0.7 | -0.9 | WARN (kept<30%) |
| Latissimus Dorsi Muscle (Right) | deep+superficial | 30714 | 7030 | 22.9 | 0.00 | 0.020 | 0.136 | 0.5 | -0.5 | -0.6 | WARN (kept<30%) |
| Levator Scapulae (Left) | superficial | 6164 | 1246 | 20.2 | 0.09 | 0.053 | 0.289 | 0.4 | -0.8 | -1.8 | WARN (kept<30%) |
| Levator Scapulae (Right) | superficial | 6164 | 1246 | 20.2 | 0.09 | 0.052 | 0.280 | 0.4 | -0.8 | -1.4 | WARN (kept<30%) |
| Long Head Of Biceps Brachii (Left) | superficial | 6436 | 1414 | 22.0 | 0.13 | 0.029 | 0.138 | 0.5 | -0.9 | -0.6 | WARN (kept<30%) |
| Long Head Of Biceps Brachii (Right) | superficial | 6436 | 1414 | 22.0 | 0.13 | 0.030 | 0.141 | 0.5 | -0.9 | -0.7 | WARN (kept<30%) |
| Long Head Of Biceps Brachii Muscle (Left) | superficial+deep | 7902 | 1580 | 20.0 | 0.03 | 0.038 | 0.202 | 0.5 | -0.6 | -0.4 | WARN (kept<30%) |
| Long Head Of Biceps Brachii Muscle (Right) | superficial+deep | 7902 | 1580 | 20.0 | 0.03 | 0.037 | 0.165 | 0.5 | -0.8 | -0.4 | WARN (kept<30%) |
| Medial Head Of Biceps Brachii Muscle (Left) | superficial | 5372 | 1374 | 25.6 | 0.05 | 0.030 | 0.160 | 0.4 | -0.3 | -0.4 | WARN (kept<30%) |
| Medial Head Of Biceps Brachii Muscle (Right) | superficial | 5372 | 1374 | 25.6 | 0.05 | 0.030 | 0.190 | 0.4 | -0.2 | -0.3 | WARN (kept<30%) |
| Pectoralis Minor Muscle (Left) | deep | 8284 | 1654 | 20.0 | 0.19 | 0.055 | 0.323 | 0.5 | -0.5 | -0.1 | WARN (kept<30%) |
| Pectoralis Minor Muscle (Right) | deep | 8284 | 1656 | 20.0 | 0.19 | 0.053 | 0.266 | 0.4 | -0.6 | -0.1 | WARN (kept<30%) |
| Rhomboid Major Muscle (Left) | superficial | 9600 | 1918 | 20.0 | 0.12 | 0.042 | 0.223 | 0.4 | -0.6 | -0.5 | WARN (kept<30%) |
| Rhomboid Major Muscle (Right) | superficial | 9600 | 1918 | 20.0 | 0.12 | 0.042 | 0.233 | 0.4 | -0.7 | -0.5 | WARN (kept<30%) |
| Rhomboid Minor Muscle (Left) | superficial | 2988 | 1198 | 40.1 | 0.13 | 0.031 | 0.240 | 0.2 | -0.1 | -1.1 | PASS |
| Rhomboid Minor Muscle (Right) | superficial | 2988 | 1198 | 40.1 | 0.13 | 0.028 | 0.219 | 0.2 | -0.0 | -0.9 | PASS |
| Scapula (Left) | bone | 606688 | 150792 | 24.9 | 0.01 | 0.003 | 0.022 | 0.0 | 0.0 | 0.0 | WARN (kept<30%) |
| Scapula (Right) | bone | 25326 | 6746 | 26.6 | 0.05 | 0.009 | 0.080 | 0.1 | -0.1 | -0.0 | WARN (kept<30%) |
| Scapular Part Of Deltoid Uscle (Left) | superficial | 8756 | 1902 | 21.7 | 0.22 | 0.059 | 0.297 | 0.5 | -0.6 | -0.4 | WARN (kept<30%) |
| Scapular Part Of Deltoid Uscle (Right) | superficial | 8756 | 1900 | 21.7 | 0.22 | 0.061 | 0.268 | 0.4 | -0.6 | -0.5 | WARN (kept<30%) |
| Serratus Anterior Muscle (Left) | deep | 50482 | 10092 | 20.0 | 0.10 | 0.028 | 0.154 | 0.4 | -0.1 | -0.4 | WARN (kept<30%) |
| Serratus Anterior Muscle (Right) | deep | 50482 | 10094 | 20.0 | 0.05 | 0.027 | 0.129 | 0.4 | -0.1 | -0.5 | WARN (kept<30%) |
| Short Head Of Biceps Brachii (Left) | superficial | 5394 | 1300 | 24.1 | 0.15 | 0.034 | 0.162 | 0.4 | -0.7 | -0.6 | WARN (kept<30%) |
| Short Head Of Biceps Brachii (Right) | superficial | 5394 | 1300 | 24.1 | 0.31 | 0.030 | 0.131 | 0.4 | -0.7 | -0.6 | WARN (kept<30%) |
| Sternocostal Head Of Pectoralis Major Muscle (Left) | superficial | 6444 | 1730 | 26.8 | 0.02 | 0.058 | 0.662 | 1.3 | -0.6 | -0.2 | WARN (kept<30%) |
| Sternocostal Head Of Pectoralis Major Muscle (Right) | superficial | 6444 | 1730 | 26.8 | 0.02 | 0.059 | 0.394 | 0.7 | -0.6 | -0.3 | WARN (kept<30%) |
| Subscapular Muscle (Left) | deep | 5910 | 1182 | 20.0 | 0.44 | 0.071 | 0.237 | 0.3 | -0.4 | -1.0 | WARN (kept<30%) |
| Subscapular Muscle (Right) | deep | 5910 | 1182 | 20.0 | 0.44 | 0.060 | 0.625 | 0.7 | -0.5 | -1.1 | WARN (kept<30%) |
| Supraspinatus Muscle (Left) | deep | 2860 | 1716 | 60.0 | 0.03 | 0.012 | 0.119 | 0.1 | 0.1 | -0.1 | PASS |
| Supraspinatus Muscle (Right) | superficial | 2860 | 1716 | 60.0 | 0.03 | 0.010 | 0.092 | 0.1 | 0.1 | -0.1 | PASS |
| Supraspinous Ligament (Right) | superficial | 1696 | 600 | 35.4 | 0.00 | 0.001 | 0.012 | 0.1 | -0.0 | 0.0 | PASS |
| Teres Major Muscle (Left) | deep | 2308 | 598 | 25.9 | 0.37 | 0.085 | 0.340 | 0.3 | -0.5 | -0.7 | WARN (kept<30%) |
| Teres Major Muscle (Right) | deep | 2308 | 598 | 25.9 | 0.37 | 0.074 | 0.418 | 0.4 | -0.6 | -0.6 | WARN (kept<30%) |
| Teres Minor Muscle (Left) | deep | 3044 | 1826 | 60.0 | 0.02 | 0.014 | 0.126 | 0.1 | 0.0 | -0.1 | PASS |
| Teres Minor Muscle (Right) | deep | 3044 | 1826 | 60.0 | 0.02 | 0.014 | 0.130 | 0.1 | 0.0 | -0.1 | PASS |
| Transverse Part Of Trapezius Muscle (Left) | superficial | 5984 | 1450 | 24.2 | 0.23 | 0.056 | 0.332 | 0.6 | -0.7 | -0.9 | WARN (kept<30%) |
| Transverse Part Of Trapezius Muscle (Right) | superficial | 5984 | 1450 | 24.2 | 0.24 | 0.054 | 0.301 | 0.5 | -0.7 | -1.0 | WARN (kept<30%) |

### Status by type

- bone: 293 structures, WARN 56, FAIL 0
- superficial: 546 structures, WARN 191, FAIL 45
- deep: 212 structures, WARN 83, FAIL 5
(structures with mixed layers appear under their own combined label)


### How to read the WARN and FAIL counts

- **WARN 348**: 347 are "kept under 30% of triangles". This is by design: the pack reduces meshes over 600 triangles to about 20% (bones 25%, rotator cuff 60%). The shape error of those structures is small (see the tables). 3 are "max error above 2%": the costal cartilages (right and left) and the right longus colli.
- **FAIL 50**: 48 are structures with under 50 triangles in lite where the original also had under 50 triangles. Nothing was lost; the pack keeps meshes of 600 triangles or fewer as they are. 2 are the sclera (left and right eye): the bounding box shrinks by 65% because the original sclera mesh contains about 12 vertex references to stray geometry roughly 5 cm away from the eye, which the decimation removed. Mean error is 0.014 to 0.018% and volume change is under 0.4%, so this is junk in the source removed, not lost detail. I did not check how these stray triangles look in the original.
- The **volume** column is unreliable for open (non-closed) meshes. The costal cartilages show a volume change of -63% although their surface error is a few millimetres. Use area change and shape error instead.
- Error numbers are one-directional (original to lite). They catch holes and missing parts in lite, but not extra geometry that exists only in lite.

## Part 3: Picking parity

Files: `part3-summary.json`, `part3-rays.csv`, `part3-disagreements.csv`.

| Rays | Count | Both models hit | Same first mesh | Same first structure | Original muscle missing from lite hits |
|---|---|---|---|---|---|
| Random | 500 | 417 | 497 | 497 | 1 |
| Shoulder muscle centres | 1,260 | 1,211 | 1,255 | 1,255 | 0 |
| All | 1,760 | 1,628 | **1,752 (99.5%)** | 1,752 | 1 |

(Rays that hit nothing in both models count as agreement. No ray hit in only one model.)

Disagreements (8 of 1,760), all between neighbouring surfaces that sit very close together, except one:

| Ray | Original first hit | Lite first hit | Distance difference |
|---|---|---|---|
| random-58 | Soleus (R) | Fibularis longus (R) | 0.13 mm |
| random-240 | Flexor digitorum profundus (L) | Proximal phalanx of 4th finger (L) | 2.0 mm |
| random-476 | Internal abdominal oblique (R) | Rectus abdominis (R) | 2.9 mm |
| Ascending trapezius (L) #15 | Platysma (L) | Sternocleidomastoid (L) | 8.4 mm |
| Long head of biceps (L) #2 | Short head of biceps (L) | Long head of biceps (L) | 0.6 mm |
| Short head of biceps (R) #12 | Short head of biceps (R) | Latissimus dorsi (L) | **-16.7 mm** (lite hit nearer) |
| Transverse trapezius (L) #4 | Clavicle (L) | Platysma (L) | 0.04 mm |
| Transverse trapezius (R) #4 | Clavicular deltoid (R) | Clavicle (R) | 0.24 mm |

Thin or small muscle missed in lite: **one case**, random-240: the original hit the left flexor digitorum profundus (7,533 triangles, 0.37 m long, 0.11 m thick) and lite hit a finger bone instead; the muscle did not appear anywhere along that ray in lite. It is not a thin or small muscle and it is not in the shoulder. No shoulder muscle was missed.

Shoulder muscle hit anywhere along the ray (not only first): 898 rays in the original and 899 in lite; none hit in the original but not in lite; 1 hit in lite but not in the original. The first hit was the targeted muscle on only 189 (original) and 188 (lite) of 1,260 rays because muscles cover each other and a bounding-box centre is not always on the muscle.

## Part 4: Visual comparison

All images are in `screens/`. Limits first: the original model cannot be loaded by the P5 viewer on this branch (the viewer only reads the lite pack), so the original/lite pairs come from an offline three.js render, not from the app. The emulator images are of the real app with the lite pack only. This is a judgement from screenshots. **You must look at the images yourself, on your phone as well.**

### Same-camera pairs (offline renders, `screens/offline/`)

For each muscle: `<muscle>-lite-overview.png`, `<muscle>-orig-overview.png`, `<muscle>-lite-close.png`, `<muscle>-orig-close.png`, for supraspinatus, infraspinatus, teres-minor, subscapularis, deltoid, trapezius, biceps-brachii, pectoralis-major (all right side; deltoid, trapezius, biceps and pectoralis show all their parts).

The table gives a pixel comparison of lite against original (mean grey-level difference, and the share of non-background pixels that differ by more than 40 of 255; the close-ups differ more because of surface texture, not outline):

| Muscle | Overview mean diff | Overview % pixels | Close-up mean diff | Close-up % pixels |
|---|---|---|---|---|
| Supraspinatus | 0.46 | 0.60 | 3.03 | 0.77 |
| Infraspinatus | 0.47 | 0.62 | 3.70 | 0.39 |
| Teres minor | 0.48 | 0.62 | 5.20 | 0.82 |
| Subscapularis | 0.47 | 1.12 | 3.44 | 0.61 |
| Deltoid | 0.47 | 0.57 | 2.16 | 0.53 |
| Trapezius | 1.33 | 0.76 | 1.24 | 0.71 |
| Biceps brachii | 0.54 | 0.62 | 0.84 | 0.71 |
| Pectoralis major | 0.96 | 0.71 | 3.29 | 0.66 |

What I see (my judgement):

- **Supraspinatus, infraspinatus, teres minor (60% of triangles kept):** outline, position and colour match the original. Lite is slightly smoother; faint fibre ridges on the surface are gone. No faceting, holes or gaps.
- **Subscapularis (20% kept):** same outline and attachment. The surface loses most of the fibre grooves, the lower edge looks a little more jagged and the surface has a few visible flat facets. No holes.
- **Deltoid (about 24% kept):** shape, the three parts and the tendon end look the same. Smoother; fibre texture reduced.
- **Trapezius (20% kept):** whole outline matches; lite is smoother, with one slightly darker patch at the lower part. Tendon areas intact.
- **Biceps brachii:** practically identical.
- **Pectoralis major:** same outline; surface smoother, rim slightly wavier. No holes.
- **Bones (clavicle 54%, humerus 34%, scapula 25 to 27% of triangles kept):** slightly more faceted shading on the humerus shaft. No gaps at the joints.
- **Colours:** same in all pairs.
- Nothing looked collapsed, missing or detached in any of the eight muscles.

### Layers of the right shoulder (lite, `screens/offline/layer-<layer>-<view>-lite.png`, front and back)

- **skin:** the layer is empty (the source has no skin mesh), so the images are blank.
- **superficial:** the superficial muscles (many muscles of the whole body, because the layer is a geometry guess).
- **deep:** disconnected fragments and islands, so the deep layer looks broken. This comes from the layer heuristic, not from decimation.
- **bone:** full skeleton, complete.

### Emulator (real app, lite pack, `screens/emulator/`)

- `p5-lite-overview-emulator.png`: P5 with the 3D body in the new layout.
- Tap-to-highlight, using adb gestures (a plain `adb input tap` is not registered by the app's touch handler; a tiny swipe was). The cyan highlight is the app's own highlight:
  - `tap-infraspinatus-lite-emulator.png` and `-zoom.png`: back view; a cyan strip on the right shoulder blade area; the sheet says "Right shoulder, back".
  - `tap-teres-minor-lite-emulator.png` and `-zoom.png`: back view; a small cyan patch next to it. At this zoom the two muscles are only a few pixels apart and small, so I could not confirm by eye which muscle each cyan area is; the tap point comes from the picker analysis.
  - `tap-subscapularis-lite-emulator.png` and `-zoom.png`: the tap selected "Right shoulder, front", but I could not confirm that the highlighted structure is the subscapularis.
  - **Supraspinatus: no tap-to-highlight image.** With all layers visible (the P5 default) the picker never returns the supraspinatus first from any tested direction (trapezius and deltoid cover it, 0 of 1,224 sampled rays). Subscapularis could be hit first by only 3 of 1,224 rays. This is how the current viewer works (layer is fixed to "all"), not a lite problem: the original behaves the same way (Part 3).
- **Load time:** the 39.2 MB pack was copied in 448 ms and read in 1,072 ms (app log). The body was on screen between 4 and 7 seconds after tapping Start (first launch, Expo Go dev mode, local network, software GL).
- **Memory:** the Expo Go process held 587 MB PSS (native heap 427 MB, Java heap 30 MB) with the lite pack shown. This includes Expo Go itself and a development build, so it is not a release-app number.
- **FPS and tap time: not measured.** This branch has no FPS or tap-time overlay and I did not add one. The emulator draws with software GL, so its FPS would not say much about a phone. For information only: when the emulator was first opened it still showed an old session of the earlier 3D test screen (a different branch) with the original model at 4 FPS and 1,610 draw calls, so the original ran in Expo Go on this emulator but very slowly.

## Weakest structures

The 10 lowest percentages of triangles kept (structures of at least 100 triangles), the 10 highest shape errors and all 59 shoulder structures are in the tables in Part 2. The weakest by shape error are the costal cartilages (maximum 2.5% of their length, about 8 mm), the longus colli, the occipital bone and the knee capsules. None is in the shoulder.

## Missing or damaged

- Missing muscles: **none**.
- Damaged: **none found**. Changes seen: fibre-level surface texture is smoothed; the sclera lost stray triangles that were in the source.

## Recommendation

**Lite is acceptable for everything tested, including the whole shoulder.** Every structure is present, the worst surface error in the shoulder is 1.26 mm, picking matches the original on 99.5% of rays, and no holes, gaps or lost parts were visible.

Optional, only if the demo needs the finest surface detail in close-up: the subscapularis (20% of triangles) and teres major (26%) show the most visible smoothing and faceting among the rotator cuff structures. They could be kept at higher detail, but this audit does not find that necessary.

Two issues found that are not caused by the lite pack:
1. The P5 viewer cannot select covered muscles with all layers visible (supraspinatus never, subscapularis hardly). If the demo should select individual rotator cuff muscles, the viewer needs a layer or depth control.
2. The layer labels are wrong in places (deep layer looks fragmented; rhomboids superficial).

## Limits of this audit

- Emulator (Pixel 7, software GL), not a real phone. FPS and tap time were not measured.
- The original could not be run in the app on this branch. Original/lite pairs are offline renders with the same lights and material, not the app's renderer. The emulator screenshots show lite only.
- Error metrics are approximations: 200 samples per mesh, original-to-lite direction only, errors in millimetres assume the model units are metres, volume is unreliable on open meshes.
- Visual statements are my judgement from screenshots and a pixel-difference count, not a clinical or anatomical review.
- The tap-to-highlight images cannot prove which exact structure was highlighted; the muscle is inferred from the picker analysis.
