# Proposal: Improve Customer Role (security + RF gaps)

## Intent
Audit found any visitor can log in as any role, self-register as admin, and read all orders/PII anonymously. Customer flow also fakes success (silent writes), trusts client prices, never calls payments, and persists no real consent. Fix now: these are critical security and Ley 81 issues, and strict TDD needs a backend runner first.

## Scope

### In Scope (MEDIUM, approved, ~7 stacked PRs into develop, merge commits)
1. pytest bootstrap: `requirements-dev.txt`, `backend/tests/conftest.py`, TestClient + in-memory SQLite overriding `get_db`, user/token factory.
2. Backend authz: login role override only behind dev flag (off by default); register forces `customer`; role-scoped `GET /orders/` (customer own, merchant own merchant, courier assigned, admin/accountant all); ownership on `GET /orders/{code}` and rating; role-lock `/payments`, `/users/arco`, `/reports/audit-logs`.
3. Frontend route guards + persisted session (role restored from token; anonymous to `/login`, wrong role to `rutaPorRol` home).
4. Store writes: no `.catch(() => {})`; real error shown; optimistic rollback.
5. Server-side pricing (RF-14/15): unit_price from catalog, delivery_fee from zone tariff; client values ignored (no distance claim).
6. Payments (RF-10): `POST /payments` (cash + simulated electronic), no card data stored, never send `tarjeta`.
7. Consent/ARCO (RF-07/09): revocable Ley 81 consent via `data_consents`, no default-True, ARCO in ProfileView, fix/remove dead policy button in LoginView.
8. Order states normalized to underscore, incl. `rechazado` in timeline and seed.

### Out of Scope (follow-ups)
- RF-03 live tracking, RF-06 product detail, RF-04 polygons, a11y pass, Playwright customer e2e.
- Secrets/CORS hardening (separate change).

## Capabilities

### New Capabilities
- `backend-testing`: pytest harness and fixtures.
- `customer-authorization`: login/register role rules, order/payment/ARCO/audit RBAC and ownership, dev-only role override.
- `session-and-route-guards`: persisted session, guards, write-failure handling and rollback.
- `customer-orders-pricing`: server-side price and fee computation.
- `customer-payments`: payment creation flow and status.
- `customer-consent-arco`: consent persistence/revocation, ARCO requests.
- `order-status-normalization`: canonical snake_case states across API, seed, UI.

### Modified Capabilities
- None (existing specs: `frontend-testing`, `landing-page`, unaffected).

## Approach
Backend-first TDD: tests red, then fix. Role-scoped listing keeps other panels working; store sync tolerates per-call 403. Dev flag (env setting, default off) preserves the demo switcher. Frontend tests via vitest (store, component, router).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/tests/`, `backend/requirements-dev.txt` | New | harness |
| `backend/app/domains/auth/service.py`, `users/{schemas,router}.py` | Modified | role rules, consent, ARCO |
| `backend/app/domains/orders/{router,service,repository,schemas}.py` | Modified | scoping, ownership, pricing, states |
| `backend/app/domains/payments/router.py`, `reports/router.py`, `core/config.py`, `seed.py` | Modified | locks, flag, states |
| `src/router.ts`, `src/stores/useGoEatsStore.js` | Modified | guards, session, writes |
| `src/views/{customer,merchant,courier}/*`, `LoginView.vue`, `ProfileView.vue`, `mockData.js` | Modified | payments, consent, states |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking merchant/courier/admin/accountant panels | High | role-scoped listing tests per role; per-call 403 tolerance |
| Breaking demo switcher/seed | Med | dev flag + seed roles verified by test |
| SQLite vs Postgres drift in tests | Med | avoid PG-only types in new code; note gap |
| No Alembic versions; `create_all` never ALTERs existing tables and seed is skipped at >= 40 orders, so an existing Postgres volume would miss new columns and status fixes | High | idempotent `run_startup_migrations` called from both `main.lifespan` and `init_db.init` on every startup: inspector add-column-if-missing, `CREATE UNIQUE INDEX IF NOT EXISTS`, backfill owner/user links where NULL, rewrite legacy status strings; each step tolerant of "already exists" so concurrent gunicorn workers do not fail. Alembic baseline deferred to a follow-up; `reseed` (drops all data) is only a documented dev fallback |
| Frontend demo flag is build-time (Vite bakes it) | Med | PR scope includes a committed `docker-compose.override.yml` (sets build arg `VITE_ENABLE_DEMO_SWITCHER=true` for local demos) and `ARG`/`ENV` in the root `Dockerfile` before `pnpm build`; production deploys with `-f docker-compose.yml` only; `.env.development` for `pnpm dev` |
| Default secrets remain | Known | out of scope, separate hardening change (compose adds env keys/build args but does not touch existing secret values) |

## Rollback Plan
Each PR is independent and merge-commit based: `git revert -m 1 <merge>` per unit, reverse order. Dev flag can restore role override in an emergency without code revert. No destructive schema changes.

## Dependencies
- pytest, httpx (present); develop branch as PR base.

## Success Criteria
- [ ] pytest and vitest suites green; written tests precede fixes
- [ ] Anonymous `GET /orders/`, `/payments`, `/users/arco`, `/reports/audit-logs` return 401/403
- [ ] Login ignores requested role; register yields customer only
- [ ] Customer cannot read/rate another's order
- [ ] Tampered price/fee ignored by server
- [ ] Failed write shows error and rolls back state
- [ ] All five role panels still load
