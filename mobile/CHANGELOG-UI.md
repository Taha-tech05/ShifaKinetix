# UI redesign changelog (branch `ui-redesign`)

UI only. No gate rules, question JSON, evaluators, SQLite layer, sync queue, answer format, narrowing/ranking/agent code or
backend file was changed (`git diff --stat 2b51683..HEAD` over those paths is empty). The only non-UI files touched are listed under
"Test and config changes" and "Strings".

## New: `src/ui/`
| File | What it is |
|---|---|
| `theme.ts` | The one place for colours: light (teal→peach), dark (Image 2 palette), and the always-dark `scene` palette. 8pt spacing, radii 20–28, 3 text sizes, 48pt touch target. |
| `ThemeProvider.tsx` | Follows the system setting; manual System / Light / Dark choice in Profile; `ThemeScope` forces a palette for a subtree. |
| `GradientBackground.tsx`, `GlassCard.tsx`, `Chip.tsx`, `FloatingControl.tsx`, `GlassNav.tsx`, `GlassSheet.tsx`, `Callout.tsx` | The shared glass components. Cards are flat (translucent fill, border, soft shadow); blur is only used on floating layers. |
| `blur.ts` | Blur is iOS only. On Android a translucent solid fill is used. `useFpsGuard` turns blur off for good if the 3D screen drops under 30 fps. |
| `scene.ts`, `SceneHost.tsx`, `SceneSheetContent.tsx`, `chat.tsx`, `ChatHistory.tsx`, `LanguageMenu.tsx` | The symptom screen (see below). |

## Screens changed
- **Every screen and shared component** now reads colours from the theme (codemod + hand fixes) and uses the gradient background,
  glass cards, accent buttons and pill chips: login, consent, language, about, profile, home, my-care and exercises placeholders, book
  placeholder, intro, fork, choice, result, doctor/server screens (`server/*`, `doctor/*`), the plain safety pages (`questions`, `result`,
  `DoctorReportScreen`) and the base components (`Screen`, `ScreenHeader`, `Card`, `Button`, `Chip`, `Banner`, `StatusChip`, ...).
- **Home**: greeting + theme toggle, search bar, one primary "Report a symptom" card, quick tiles, upcoming appointment card.
- **Floating glass bottom nav** (Home / My care / Exercises / Profile) with a raised centre "+" that opens `report/intro`.
- **Symptom flow** (`report/body`, `confirm`, `basics`, `danger`/`reask` (SafetyQuestionnaire), `safe`, `movement`, `urgent`, `unclear`):
  `report/_layout.tsx` mounts the 3D body and one glass chat sheet **once**; each route hands its content to the sheet through
  `SceneSheetContent`, so the body and the sheet stay mounted while the question changes. Routes, params, callbacks and the answer
  saving/gate calls are unchanged. The sheet shows the saved answers above as chat history (read-only), a typing indicator before each
  new message, and a persistent "Talk to a doctor instead" pill.
- **Tap callout**: the Body3D projects the tapped point each second frame into Reanimated shared values (no React state per frame). The
  callout shows only the region name from the confirm step, fades when the point turns away, flips near edges, stays above the sheet,
  mirrors for Urdu.
- **Movement steps**: sheet collapses to peek while the animation plays, an instruction chip with the safety line stays on screen, the sheet
  opens to half and shows the answers once the animation has played once, Replay collapses it again, and dragging the sheet stops the
  automation for that step. Reduce-motion snaps instantly.
- **Red flag / unclear**: calm takeover at half height, body dimmed, "Connect to a doctor" and "Call emergency help (1122)". No questions,
  exercises or suggestions.

## Test and config changes (needed because UI moved)
- `jest.config.js` + `__tests__/support/{expo-blur,reanimated}.tsx`, `react-native.tsx` (adds `Platform`, `useColorScheme`): stand-ins for the new UI modules.
- 5 test files had assertions that read the **old layout** of the live screen from source or text (model on top with `flex:1`, `maxHeight: textMax`,
  the slim demo/caution strip, "Possible so far" band strip, `autoFocus={` in the route). They were updated to the new structure. Behaviour tests
  (answers saved as unknown, gate re-run, Back undoes, red flag routing, doctor-only differential) are unchanged and pass.
- Result: 32 suites, 601 tests pass; `tsc --noEmit` clean; Android bundle builds with `expo export`.

## Strings
`scene.*` and `profile.theme*` keys were added in English, Urdu and Roman Urdu. **Urdu and Roman Urdu need a native-speaker review**, like the existing ones.

## Not done, differs from the brief, or not verified
- **Not run on a device.** I could not run an emulator here: the look, blur, the 30 fps target on a mid-range Android phone, the callout tracking, and the
  sheet behaviour are untested on hardware.
- **No WebView.** The 3D view is native (expo-gl + react-three-fiber), so the callout is a React Native overlay driven by a projection hook, not a DOM overlay.
- **The 3D look**: the app's existing studio was light; the scene is now always dark (`#3D84AD` centre → `#0D2036` edges, orange glow) as the brief describes. Model, materials and colours are unchanged.
- **Two 3D stages.** Picking uses `Body3D`, movements use `SegmentedBody`; the pack is cached, so the body does not reload between questions, but the stage component swaps once when the flow moves from the safety questions to the movements.
- **Number/duration safety questions** still use a text field (the existing test and the answer validation need it). It is not focused automatically and has −/+ buttons, but the keyboard appears if the field is tapped. The brief says no keyboard outside the AI chat.
- **Camera re-frame above the sheet** resizes the 3D area to the part above the sheet instead of changing the camera maths.
- **Screens that do not exist** were not invented: wallet, records list, doctor list/booking, physio and admin dashboards. `book`, `my-care`, `exercises` remain "full project" placeholders (restyled). The nav's third tab is Exercises, not Records, for the same reason.
- **Straight Leg Raise** "lie down first" bubble is wired (matches ids like `straight_leg…`) but the shoulder movement set has no such movement.
- **Result screen** still shows the existing strength bands/bars (pre-existing, with tests). The brief's "no scores or ranking" rule was applied to the 3D symptom screen only.
- **Contrast**: `muted` is `#486A6B` (slightly darker than `#5B7B7C`) and filled buttons use `#0E7C76` so text meets WCAG AA. Not measured with a tool.
- `theme/colors.ts` still exists for the static shadows and the 3D loader; screens no longer read it.
- Not built: Doctor report layout changes beyond theming; wallet/payment; consultation thread list.

## Round 2 (after testing on a Pixel 7a)

**Look and feel**
- Light palette now follows `docs/design/download.jpg` (frosted near-white screens with a faint teal edge on the left and a faint peach edge on the right, white
  cards, teal accent, white nav pill with a raised teal "+"). Dark palette follows `994f54f2...webp` (steel blue, translucent cards, lime accent). Every colour is a
  token in `src/ui/theme.ts`. The saturated gradient of round 1 turned grey in the middle and is gone; Android's elevation shadow no longer shows through the cards.
- Layout follows the light reference: Home is a dashboard (title row, search, overview card, "Upcoming" with a View All link, Quick Actions), Profile uses record-style
  rows, the doctor cases list uses provider-style cards, every screen header has a round back button, a centred title and the language and SOS controls.
- New `ui/` pieces: `SectionHeader`, `ListRow`, `Legend`, `chat` (bubbles with a ShifaKinetix label, typing dots), `SceneHost` (see below).

**Symptom flow**
- The 3D body is full screen, directly on its original studio background (no card, border or rounded frame, no new glow or gradient). The result screen
  is now a scene route too, so it shows the same body, with the result in the sheet (it used to draw its own boxed body).
- No header bar on this screen: only Back, Muscle/Bone, the region chip and SOS float over the body. The progress line, language menu, colour guide and "Talk to a
  doctor instead" are in the sheet header. The demo notice is the first message of the chat (dismissible). The app-wide strip is off here.
- The sheet is a frosted-glass layer over the body (real blur on iOS and on Android 12+ through `BlurTargetView`, a nearly solid fill if blur is unavailable or
  the frame rate drops). It is always anchored to the bottom and only changes height: handle-only (model alone), peek (movement steps), compressed, expanded.
- The flow follows the app's light or dark palette (it no longer forces the dark blue-green in light mode).
- No red outside emergencies (errors, upload failures, the body marker now use the warning colour with an icon). Colour roles: bot, patient, selected region,
  "May be involved", warning, AI, red-flag; the colour guide (info icon in the sheet) explains them.
- The red-flag questions use the full-screen chat (no 3D canvas mounted); the region chip stays on top.
- One persistent chat list: a new question is appended, the list follows it when the patient is at the newest message and otherwise keeps its position and offers a
  "Current question" pill.

**Tests**: still 601 pass. Assertions that read the old UI source were updated again where the code moved (list in the commit).

**Not verified on the phone**: the movement step (collapse/expand, instruction chip) and the new result screen. The unit tests cover their logic. Needs a manual pass.
**Known gaps**: the "after an injury" chip text wraps and clips in one render of the basics chat; the model can be rotated into a flat pose by a vertical drag (original viewer behaviour).
