# Android acceptance record (gate contract v2)

Draft, awaiting clinician review. Fictional demo assessments only.

Replaces the shoulder-2 checklist from `feature/A-device-testing` (commit c00e92f), which described the old
flow. Expected results below follow [gate-contract.md](gate-contract.md) v2 (content `shoulder-3`).

## Before testing

- Build: a demo APK built by Taha from develop **after PR #13** (`3ae4600` or later). See [demo-apk.md](demo-apk.md).
  An APK built before PR #13 uses shoulder-2 and will not work with the updated server.
- Server: Saud's server restarted with the same develop commit, run as in demo-apk.md, with the demo cases seeded.
- Phone and laptop on the same Wi-Fi; Profile → Server (demo) points at the laptop address.
- Record for every row: APK commit, phone model and Android version, tester, date, exact answers, what the
  screen showed, pass/fail. Keep tokens and personal information out.

Expected results are not observed results. Every row stays **Pending** until it is actually run.

## Safety check: fewer, linked questions

| ID | Action | Expected result | Observed |
| --- | --- | --- | --- |
| D1 | Launch; language; demo sign-in and consent; choose the shoulder; start the safety check | Questions render without a runtime error | Pending |
| D2 | Basics: "slowly", pain 3. Safety: No to everything | Six safety questions only (chest, breathing, unable, unusual feeling, red/hot/swollen, weight loss/cancer); "Already answered earlier" line names how it started and the pain score; Routine; Continue opens the movements | Pending |
| D3 | As D2, but leave the basics pain score as Not sure | Pain score is asked once in the safety check (seven questions) | Pending |
| D4 | "Unusual feeling" Yes, then No / "Yes, but it comes and goes" / "Neither" | Only then are numbness, pins and needles and hot/cold asked; result Routine (1 point) | Pending |
| D5 | "Unusual feeling" Not sure | Its detail questions are asked; no stop | Pending |
| D6 | Chest: Not sure, then Not sure again | First tap shows the explanation on the same card (nothing saved); second tap goes to the Unclear screen; no movements | Pending |

## Care levels

| ID | Action | Expected result | Observed |
| --- | --- | --- | --- |
| D7 | Basics "after an injury", pain 4; "changed shape" No; everything else No | Soon card: "see a doctor in the next few days", reason "The pain started after an injury or accident"; Continue goes to the questions with no movements | Pending |
| D8 | Basics "after an injury", pain 9 | Urgent as soon as the pain score is filled; reasons list injury and very bad pain; no movements | Pending |
| D9 | Chest Yes | Emergency: "Call emergency help now"; the 1122 button comes before the doctor button | Pending |
| D10 | "Completely unable to move this arm" Yes | Urgent: "Cannot move the arm at all" | Pending |
| D11 | Red/hot/swollen Yes; Neither; Not swollen; red Yes | Infection-risk question in the same flow; Yes gives Urgent; No continues to fever | Pending |

## Movements and narrowing

| ID | Action | Expected result | Observed |
| --- | --- | --- | --- |
| D12 | Routine patient: mark movements painful, weak, Skip and Not sure | No safety question comes back; the flow continues | Pending |
| D13 | Mark one movement "couldn't do", then finish the other five | Nothing interrupts the set; after the sixth, one check: "Earlier you said you can move this arm. Which is closer?" with two answers | Pending |
| D14 | Answer D13's check "It moves, but it is painful or limited" | Back to the narrowing questions; the check does not come again | Pending |
| D15 | Repeat D13 and answer "I really cannot lift or move it" | Urgent | Pending |
| D16 | Narrowing questions | No question about tingling or numbness is asked | Pending |

## Saving, offline and server

| ID | Action | Expected result | Observed |
| --- | --- | --- | --- |
| D17 | While the app is loaded, airplane mode on; answer and save | In-session safety check and saving work without the server | Pending |
| D18 | Force-close, reopen, explicitly resume | Answers and context restored; the gate is recomputed; prefilled answers are not asked again | Pending |
| D19 | Installed APK: airplane mode, force-close, cold start, resume | Launch and saved assessment work without Metro or the server | Pending |
| D20 | Connectivity on; upload; interrupt and retry | No lost or duplicate events; server verdict and level match the phone | Pending |
| D21 | Doctor account opens the uploaded case; patient account tries the doctor report | Doctor sees the gate with its level and reasons; patient is denied | Pending |
| D22 | Movement, Back, restart and resume, upload | Superseded history and snapshots kept; doctor audit matches | Pending |

Expo Go or Metro loading errors during a cold start are not proof of a storage failure. D19 needs an installed
APK; do not mark offline cold start passed from Expo Go alone. Clinician review of the questions, points and
wording is a separate acceptance item and stays pending.
