# ShifaKinetix

[![CI](https://github.com/Taha-tech05/ShifaKinetix/actions/workflows/ci.yml/badge.svg)](https://github.com/Taha-tech05/ShifaKinetix/actions/workflows/ci.yml)

ShifaKinetix is a final-year project: a mobile musculoskeletal-pain care app. A short safety gate screens for danger signs first, then guided questions and movement checks narrow down which muscles may be involved, and the app suggests a care pathway. The mid-term scope covers the **shoulder only**. All clinical content (questions, rules, thresholds) is draft and awaiting clinician review.

> **Demo only, not for real patients.** This software is not a medical device and must not be used for diagnosis or treatment.

## Team

| Person | GitHub | Role |
|---|---|---|
| A | @Zaid2004fast | Safety gate, questions, tests |
| B | @Taha-tech05 | Expo mobile app |
| C | @SaudurRahman997 | FastAPI server |

## Repository layout

| Folder | Contents |
|---|---|
| `mobile/` | Expo (React Native, TypeScript) app |
| `server/` | FastAPI server |
| `shared/` | Formats, gate rules, questions and test cases used by both sides |
| `docs/` | Project documentation |

## Person A shoulder safety demo

The feature branch adds sourced draft questions, a conservative TypeScript
gate, offline SQLite storage, question screens and a doctor report integration
component. See [run and integration instructions](docs/person-a-handoff.md),
[verification evidence](docs/person-a-verification.md), and the
[clinician review brief](docs/clinician-shoulder-summary.md).

The Python gate, authenticated doctor API and full mobile-shell integration
remain team dependencies. Do not merge while gate parity fails.

## How to contribute

- Branch naming: `feature/<person>-<task>` (for example `feature/zaid-gate-rules`).
- Open pull requests into `develop`. Never push directly to `main` or `develop`.
- Every PR needs one approval from a different person than the author, and CI must pass.
- Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `ci:`, `chore:`.
