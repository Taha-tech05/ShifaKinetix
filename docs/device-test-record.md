# Android acceptance record

Draft, awaiting clinician review. Fictional demo assessments only.

## Verified starting point

- PR9, PR8 and PR2 merged; develop: `e2d9471934a1730cf77496c0302e18d6ed5ad95e`.
- [Post-merge CI passed](https://github.com/Taha-tech05/ShifaKinetix/actions/runs/38360506257).
- Local develop updated; testing branch: `feature/A-device-testing`.
- User selected Android + Expo Go; Expo Go not installed when this record began.
- App SDK: Expo 57; local Node: 22.16.0. No Android device connected through ADB.
- Phone model, Android version, Expo Go version, date/tester: **to record**.
- Hosted API URL and account provisioning: **not yet supplied in this session**.

## First launch

Install [Expo Go for Android/SDK 57](https://expo.dev/go?sdkVersion=57&platform=android&device=true).
Put the computer and phone on the same Wi-Fi. Start the server in `mobile`:

```powershell
npx.cmd expo start --go --lan --port 8081
```

Scan the terminal QR code in Expo Go, or enter the Expo address printed by the
server. Leave the server running. Use the current Wi-Fi address, not a WSL adapter.
The first app screen's prefilled login is a demo UI; it does not authenticate
server uploads or doctor access. Those use the separate Saved assessment and
sync panel and server-issued accounts/tokens.

If Windows asks about network access, permit the trusted private network used
for this test. Do not disable the firewall. Record any loading error verbatim.

## Cases to execute and record

All rows below are **pending**. Expected results are not observed test results.
Use a new fictional assessment for each independent scenario.

| ID | Action | Expected result | Observed result |
| --- | --- | --- | --- |
| D1 | Launch; select language, demo sign-in/consent, choose shoulder and start safety check | Questions render without a runtime error | Pending |
| D2 | Fictional gradual-onset case; no warning symptoms; normal temperature; complete remaining questions consistently | SAFE, then Continue opens the applicable narrowing/movement flow | Pending |
| D3 | Choose After injury in basics | Safety follow-up rather than an automatic basics-screen RED_FLAG | Pending |
| D4 | Confirm Yes to the actual injury safety question | Existing draft injury rule stops the flow; it was not removed | Pending |
| D5 | Required safety answer Not sure, then Not sure again when asked | CLARIFY/unclear; movement checks stay blocked | Pending |
| D6 | Redness Yes; infection-risk answer unknown, then clarify explicitly | Unknown remains blocked; reevaluate complete gate after resolution | Pending |
| D7 | After SAFE, record a new weak/unable movement | Fresh safety follow-up; old negatives cannot clear new evidence | Pending |
| D8 | While app is loaded, turn on airplane mode, save answers; restore connectivity before reloading if Metro is needed | In-session safety evaluation/save works without backend connectivity | Pending |
| D9 | Force-close, reopen and explicitly resume | Saved answers/context restore; gate is recomputed | Pending |
| D10 | Installed preview APK: airplane mode, force-close, cold-start and resume | Launch and saved assessment work without Metro or backend | Pending; APK required |
| D11 | Upload with provisioned patient account; interrupt/retry | No queue loss or duplicate server event; report matching server result | Pending; API access required |
| D12 | Doctor account loads matching report; patient denied; disconnect | Authorized report only; disconnect clears it | Pending; API access required |
| D13 | Movement, Back, restart/resume and upload | Superseded history/snapshots retained, audit matches | Pending |

Expo Go/Metro loading errors during a cold start are not proof of a SQLite
failure. D10 must use a build with its JS/assets embedded; the existing EAS
preview profile requests an Android APK. Coordinate that build with Taha.
Do not mark offline cold-start acceptance passed based on an export or Expo Go
session alone. B/C narrowing-bank equivalence and clinician review are separate
acceptance items and remain pending.

For each executed row add build/commit, device/OS, exact actions/answers, observed
screen/verdict, date and pass/fail. Keep tokens and personal information out.
