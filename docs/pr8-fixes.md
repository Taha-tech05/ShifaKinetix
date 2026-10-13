# PR8 boundary fixes — 2026-10-13

Draft, awaiting clinician review. Engineering fixes; clinical criteria unchanged.

Prepared on feature/A-pr8-safety-fixes, based on PR8 f6c5601 and merged with
feature/A-gate ba6ba6e. This supplements the historical findings in pr8-review.md.

## Changes

- Validate the entire stored canonical answer collection before app adapter
  filtering. Invalid safety IDs stay blocked rather than disappearing.
- Validate movement identity, Boolean flags and finite optional angle before
  signal derivation. Explicit null collections fail closed. Existing skipped
  movement clarification behavior and valid follow-up handling are preserved.
- When upgrading the legacy schema, baseline old contexts at the highest
  pre-upgrade answer sequence. Old answers cannot become new reviews. New
  explicit answers can resolve the follow-up; repeated startup preserves them.
  No old event row is updated or deleted.
- Add API tests covering gate, patient report and doctor differential blocking,
  plus correction/recovery. Extend the migration regression with recovery and
  repeated-startup checks. Retain all existing fixtures and assertions.
- Include A's fixture metadata/order corrections, reviewed-boundary CI tests,
  and CI triggers for stacked safety/server PRs.

## Local verification

Python 3.12, Node 22.16:

- 2484 tests pass: 2480 server tests plus four boundary regressions.
- All 47 canonical and 51 app-signal complete outputs match across languages.
- Server and regression-script Ruff checks pass.
- Clinical rules, question wording and expected shared outputs are unchanged.

GitHub CI/independent review must be checked separately before merging. Local
tests used SQLite, not PostgreSQL. No new phone/device result is claimed.

## Delivery and remaining work

Saud can review and merge this fix PR into feature/C-server with a normal merge;
that updates the existing PR8. Then verify PR8 CI and obtain the required review
before merging PR8 into A. PR2 remains draft until the combined result is checked.

This resolves the three reproduced boundary findings; it does not implement
ordered offline transport, finish app/server narrowing integration, validate
clinical rules, or certify an installed-device flow. Never flush a latest
context snapshot ahead of older answer events. See server-api.md for the exact
sync contract and legacy-migration limitations.
