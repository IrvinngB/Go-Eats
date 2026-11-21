# Archive Report: Improve Customer Role (security + RF gaps)
- Verdict: PASS WITH WARNINGS (CRITICAL 0 / WARNING 5 / SUGGESTION 2)
- Tasks: 38/42 complete (open: 10.3 partial, V.1-V.3 not executed by user decision)
- Capabilities synced (all NEW, full spec saved to `keel/specs/<capability>/spec.md`):
  - backend-testing: 9 added / 0 modified / 0 removed
  - customer-authorization: 9 added / 0 modified / 0 removed
  - session-and-route-guards: 10 added / 0 modified / 0 removed
  - customer-orders-pricing: 11 added / 0 modified / 0 removed
  - customer-payments: 8 added / 0 modified / 0 removed
  - customer-consent-arco: 8 added / 0 modified / 0 removed
  - order-status-normalization: 9 added / 0 modified / 0 removed
- Artifacts: proposal, exploration, clarifications, blast-radius, design, specs/* (7), tasks, apply-progress, verify-report, state
- Delivered: PRs #20-#29, plus fix #30 (demo credentials) and follow-up #44 (customer orders identified by account id)
- Completed: 2026-11-21

## Open warnings carried over
- V.1-V.3 not executed by user decision: startup migration, advisory lock and status rewrite never run against the real Postgres volume; compose images and flag override not built.
- 10.3 partial: `.env.development` (`VITE_ENABLE_DEMO_SWITCHER=true`) must be created by the user.
- backend-testing: the SQLite/Postgres gap (and how to run pytest) is not documented.
- Observability (design section): missing auth WARNING when a body `role` is ignored, authz WARNING on scoped 404/403, and payments INFO gateway-result logs.
- ADR8 deviation: `installGuards(router, store, ready)` signature instead of `getSession` (documented; behavior covered by guards.spec).

## Pre-existing, out of scope
- CORS `allow_origins=["*"]` with `allow_credentials=True` (`backend/app/main.py`).
- Default JWT/S3 secrets (`backend/app/core/config.py`).
- Address both in a dedicated hardening change.
