# Team workflow

Demo only, not for real patients. All clinical content is draft, awaiting clinician review.

## Roles

| Person | GitHub | Area |
|---|---|---|
| A | @Zaid2004fast | Safety gate, questions, tests |
| B | @Taha-tech05 | Expo mobile app |
| C | @SaudurRahman997 | FastAPI server |

## Branches

| Branch | Purpose | Who pushes | How changes get in |
|---|---|---|---|
| `main` | Stable, demo-ready. Pushes trigger CD. | Nobody directly | PR from `develop`, 1 approval, CI green, conversations resolved |
| `develop` | Integration branch (default) | Nobody directly | PR from a feature branch, 1 approval from a different person, CI green |
| `feature/<person>-<task>` | One task per branch | The task owner | Open a PR into `develop`; branch is deleted after merge |

Required CI checks on both protected branches: `mobile`, `server`, `gate-parity`.

## Commit prefixes

| Prefix | Use for |
|---|---|
| `feat:` | New functionality |
| `fix:` | Bug fix |
| `test:` | Adding or changing tests |
| `docs:` | Documentation and shared data/format descriptions |
| `ci:` | Workflows and pipeline changes |
| `chore:` | Housekeeping, config, structure |

Keep commits small. Merge commits or rebase merging only (no squash), so each member's history is kept.

## Rules

- **Any change to `shared/gate_rules.json` needs approval from both Person A and Person C.**
- Every new question or rule needs a non-empty `source` and the label "draft, awaiting clinician review". Never write "doctor-validated".
- A "not sure" answer on a key danger question must never produce `SAFE`.
- No patient-facing path returns the differential diagnosis.
- Never commit secrets, `.env` files or keys.
