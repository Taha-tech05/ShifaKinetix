## Part 2 totals

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

### Shoulder structures (75)

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
| Deep Head Of Prontaor Teres Muscle (Left) | superficial | 2230 | 818 | 36.7 | 0.03 | 0.027 | 0.269 | 0.3 | -0.1 | -0.6 | PASS |
| Deep Head Of Prontaor Teres Muscle (Right) | superficial | 2230 | 818 | 36.7 | 0.03 | 0.027 | 0.226 | 0.2 | -0.3 | -0.6 | PASS |
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
| Levator Anguli Oris (Left) | superficial | 662 | 600 | 90.6 | 0.03 | 0.009 | 0.039 | 0.0 | -0.1 | 0.0 | PASS |
| Levator Anguli Oris (Right) | superficial | 662 | 600 | 90.6 | 0.03 | 0.009 | 0.068 | 0.0 | -0.1 | 0.0 | PASS |
| Levator Labii Superioris (Left) | superficial | 1080 | 600 | 55.6 | 0.11 | 0.042 | 0.277 | 0.1 | -0.1 | -0.4 | PASS |
| Levator Labii Superioris (Right) | superficial | 1080 | 600 | 55.6 | 0.11 | 0.053 | 0.335 | 0.1 | -0.1 | -0.5 | PASS |
| Levator Nasolabialis (Left) | superficial | 344 | 344 | 100.0 | 0.04 | 0.006 | 0.035 | 0.0 | 0.0 | 0.0 | PASS |
| Levator Nasolabialis (Right) | deep | 344 | 344 | 100.0 | 0.01 | 0.004 | 0.025 | 0.0 | -0.0 | 0.1 | PASS |
| Levator Palpebrae Superiorisl Grp1 | superficial | 4306 | 860 | 20.0 | 0.06 | 0.074 | 0.351 | 0.2 | -0.4 | -1.7 | WARN (kept<30%) |
| Levator Palpebrae Superiorisr Grp1 | superficial | 4306 | 860 | 20.0 | 0.06 | 0.070 | 0.253 | 0.1 | -0.3 | -1.8 | WARN (kept<30%) |
| Levator Scapulae (Left) | superficial | 6164 | 1246 | 20.2 | 0.09 | 0.053 | 0.289 | 0.4 | -0.8 | -1.8 | WARN (kept<30%) |
| Levator Scapulae (Right) | superficial | 6164 | 1246 | 20.2 | 0.09 | 0.052 | 0.280 | 0.4 | -0.8 | -1.4 | WARN (kept<30%) |
| Levatores Breves Costarum (Left) | deep | 5382 | 1074 | 20.0 | 0.08 | 0.026 | 0.264 | 0.9 | -1.7 | -1.9 | WARN (kept<30%) |
| Levatores Breves Costarum (Right) | deep | 5382 | 1076 | 20.0 | 0.08 | 0.029 | 0.387 | 1.3 | -1.6 | -2.0 | WARN (kept<30%) |
| Levatores Longi Costarum (Left) | deep | 11860 | 2372 | 20.0 | 0.05 | 0.024 | 0.109 | 0.4 | -0.7 | -1.6 | WARN (kept<30%) |
| Levatores Longi Costarum (Right) | deep | 11860 | 2372 | 20.0 | 0.03 | 0.021 | 0.109 | 0.4 | -0.8 | -1.6 | WARN (kept<30%) |
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
| Superficial Head Of Pronator Teres Muscle (Left) | superficial | 5092 | 1352 | 26.6 | 1.54 | 0.030 | 0.243 | 0.4 | -1.0 | -0.2 | WARN (kept<30%) |
| Superficial Head Of Pronator Teres Muscle (Right) | superficial | 5092 | 1352 | 26.6 | 1.54 | 0.033 | 0.230 | 0.4 | -1.0 | -0.3 | WARN (kept<30%) |
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
