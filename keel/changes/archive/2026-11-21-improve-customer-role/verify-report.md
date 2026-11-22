# Verification Report: Improve Customer Role

Branch `develop` (PR1-PR10 + follow-ups merged). Verified 2026-11-21.

## Completeness
| Task | Status |
|------|--------|
| 1.1-10.5 (38 tasks) | done |
| 10.3 `.env.development` | open: file absent (env permission denied during apply); rest of 10.3 done |
| V.1-V.3 (Postgres volume, compose build, compose browser check) | not executed by user decision |

## Execution Evidence (run one at a time)
- `cd backend && .venv/bin/pytest -q` -> 405 passed, 0 failed, exit 0 (13 warnings, Pydantic enum serializer on flag-on login)
- `pnpm test` -> 69 files, 1260 passed, exit 0 (includes real `vite build` demo-gating test)
- `pnpm exec vue-tsc -b` -> exit 0
- `pnpm test:e2e` -> 177 passed, exit 0
- `tsconfig.app.tsbuildinfo` restored; nothing staged.
- strict_tdd: TDD Cycle Evidence tables present for every PR in apply-progress.

## Spec Compliance Matrix (evidence by file)
| Spec | Covering tests | Status |
|------|----------------|--------|
| backend-testing | test_smoke, conftest, test_migrations, test_auth (flags) | PASS except doc req below |
| customer-authorization | test_auth, test_orders_scope, test_linked_entity_and_locks, test_orders_customer_only, test_status, test_consent, MerchantView/CourierView specs | PASS |
| customer-orders-pricing | test_pricing, test_codes, test_orders_delivery_coords, useGoEatsStore.writes/identity specs, StoreDetailView.spec, e2e checkout-address | PASS |
| customer-payments | test_payments, test_payment_method, test_codes, PaymentGatewayModal.spec, StoreDetailView.spec | PASS |
| order-status-normalization | test_status, test_migrations, test_reports_revenue, orderStatus.spec, OrderTimeline/OrderProgress specs, OrdersView.spec | PASS |
| customer-consent-arco | test_consent, useGoEatsStore.consent.spec, ProfileView.spec, LoginView.spec (policy control), e2e customer-profile-design | PASS |
| session-and-route-guards | guards.spec, router.spec, api.spec, App.sync.spec, TopBar.spec, LoginView.spec, demoGating.build.spec, e2e guards | PASS |

Requirements with NO proof:
- backend-testing / Documented SQLite/Postgres gap: no backend testing notes exist (README, backend/, conftest have no SQLite-vs-Postgres limitation or run instructions).

## Security Review
| Check | Result |
|-------|--------|
| Authz per role (orders list/read/rate/create, locks, status, payments receipt) | OK: test_orders_scope, test_status, test_linked_entity_and_locks, test_orders_customer_only, test_payments |
| Login role override | OK: `settings.dev_role_override` default off, env-only; body/header/query cannot enable (test_request_cannot_enable_flag) |
| Register role | OK: forced customer (test_register_role_admin_becomes_customer) |
| Refresh role | OK: DB role, suspended rejected (test_refresh_*) |
| Consent gate | OK: 403 `consent_required` on orders and payments, nothing created (test_consent) |
| Payments ownership / amounts | OK: foreign order 404, client amounts ignored, one active payment 409 |
| Card data | OK: store sends only `order_code`, `method` (+ `simulate_failure`, ignored unless server flag on); server drops card fields (test_card_fields_are_dropped_never_stored_or_logged); modal never leaks to Pinia/storage |
| Redirect allow-list | OK: `safeRedirect` 20 malicious inputs (guards.spec), `//evil.com` e2e |
| Demo credentials in flag-off bundle | OK: demoGating.build.spec asserts absence of `demo1234`/`ejemplo.pa` |
| CORS / secrets | Pre-existing, out of scope (see SUGGESTION) |

## Issues
### CRITICAL
- None.

### WARNING
- V.1-V.3 not executed by user decision: startup migration, advisory lock and status rewrite never run against the real project Postgres volume; compose images/flag override not built.
- Task 10.3: `.env.development` (`VITE_ENABLE_DEMO_SWITCHER=true`) does not exist; the dev server has no demo switcher until the user creates it.
- backend-testing spec: SQLite/Postgres gap and how to run pytest are not documented (MUST in spec).
- Observability (design section): migration and code-collision logs present (`backend/app/core/migrations.py`, `orders/repository.py:95`, `payments/repository.py:72`); missing the planned auth WARNING when a body `role` is ignored, authz WARNING on scoped 404/403, and payments INFO gateway result.
- Design ADR8 deviation (documented): `installGuards(router, store, ready)` instead of `getSession`; behavior covered by guards.spec.

### SUGGESTION
- Pre-existing: `backend/app/main.py:41` `allow_origins=["*"]` with `allow_credentials=True`; `backend/app/core/config.py:14,21` default JWT/S3 secrets. Address in a hardening change.
- Silence the Pydantic enum serializer warning on flag-on login (role returned as str).

## Verdict: PASS WITH WARNINGS
CRITICAL 0 / WARNING 5 / SUGGESTION 2.
