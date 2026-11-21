# Tasks: Improve Customer Role

> Slicing revision: the design's 10-PR slicing was BREAKS-UNHANDLED per blast-radius. Re-sliced below (same 10 PRs, moved content): status rewrite + canonical seed + `rechazado` + reports now land WITH the frontend canonical keys (PR5); `restaurarSesion`, fallback removal and role-gated sync land together (PR4); `yappy` wiring + dropping client price/fee land in the same PR as the Literal (PR6); `backend/.dockerignore` moves to PR1; PR2 is additive only. Base branch is `develop`.

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Estimated changed lines: ~3,500-4,000 total · Delivery strategy: stacked PRs into `develop`, merge commits, auto mode (user approved). Units 4, 5, 6 are likely 500-650 lines each: they are indivisible by compatibility (backend+frontend must ship together), so they are accepted size exceptions, not a reason to ask.

### Suggested Work Units

| Unit | Goal | Base | Forecast |
|------|------|------|----------|
| PR1 | Backend test harness | develop | ~180 |
| PR2 | Migration module + entity link + seed link (additive) | PR1 | ~300 |
| PR3 | Auth hardening + LoginView by server role | PR2 | ~250 |
| PR4 | Scoped reads, locks, allSettled sync, session restore, no fallbacks | PR3 | ~600 (exception) |
| PR5 | State machine + canonical states end to end | PR4 | ~550 (exception) |
| PR6 | Server pricing, codes, merchant check, method Literal + yappy wiring | PR5 | ~500 (exception) |
| PR7 | POST /payments + async crearPedido | PR6 | ~420 |
| PR8 | Store write rollback, typed errors | PR7 | ~380 |
| PR9 | Consent/ARCO | PR8 | ~350 |
| PR10 | Guards, demo flag, Docker, e2e | PR9 | ~450 |

Every PR gate: `cd backend && .venv/bin/pytest`, `pnpm test`, `pnpm exec vue-tsc -b`, `pnpm build`. Each task below: write the named failing test (RED) first, then implement (GREEN).

## PR1: Harness
- [x] 1.1 Run `python3.12 -m venv backend/.venv` (NOT default 3.14); create `backend/requirements-dev.txt` (`-r requirements.txt`, `pytest>=8`); pip install into the venv.
- [x] 1.2 Create `backend/.dockerignore` (`.venv`, `tests`, `requirements-dev.txt`, `__pycache__`, `.pytest_cache`); add `.pytest_cache/` and `backend/.venv` to `.gitignore`. Verify prod Dockerfile still installs only requirements.txt.
- [x] 1.3 RED `test_smoke.py::test_health_ok`; create `pytest.ini` (`pythonpath=.`), `tests/conftest.py` (`DATABASE_URL=sqlite://` before importing app, StaticPool + `check_same_thread=False`, `get_db` override, `TestClient(app)` without context manager, `import app.init_db`).
- [x] 1.4 Create `tests/factories.py` (`make_user/merchant/courier/zone/product`, `auth_headers`, precomputed bcrypt hash).
- [x] 1.5 GREEN: `test_smoke.py::test_login_with_factory_user`, `test_no_goeats_db_created`.

## PR2: Migration + link (additive only; no status rewrite, no `rechazado`)
- [x] 2.1 RED `test_migrations.py::test_adds_columns_links_idempotent` (legacy DDL, run twice, 8 links by email, views' statuses untouched); GREEN: create `core/migrations.py` (advisory lock 724001 on PG, inspect add-column, `CREATE UNIQUE INDEX IF NOT EXISTS`, duplicate-column catch, backfill map, INFO counts).
- [x] 2.2 Add `merchants.owner_user_id`, `couriers.user_id` (nullable, unique, indexed, same index names) to models; define shared `ENTITY_LINKS`.
- [x] 2.3 Wire `create_all` -> `run_startup_migrations` -> `seed` in `main.lifespan` and `init_db.init()`; seed sets links on fresh DB (test `test_fresh_seed_links_entities`, `test_fresh_schema_noop`).
- [x] 2.4 Verify seeded users have consent rows (seed.py:83) and record result in PR description.

## PR3: Auth hardening
- [x] 3.1 RED `test_auth.py::test_login_ignores_role_flag_off`, `test_login_honors_role_flag_on`; GREEN: add `dev_role_override`, `dev_simulate_failure` to `config.py` (1/true/yes), gate login role.
- [x] 3.2 RED `test_register_role_admin_becomes_customer`, `accepts_privacy_policy` default False; GREEN: remove `UserCreate.role`.
- [x] 3.3 RED `test_refresh_uses_db_role`; GREEN: `auth/service.py` refresh.
- [x] 3.4 RED LoginView spec (navigates by server role); GREEN: LoginView uses `store.rol`; role picker gated (hidden unless backend override flag path is irrelevant: remove picker), checkbox only on register; store no longer sends `role`/default consent True.

## PR4: Scoped reads + locks + sync + session restore
- [x] 4.1 RED `test_orders_scope.py` (customer own, merchant linked, unlinked `[]`, courier, admin/accountant all, anon 401, other-order GET 404); GREEN: `OrderService.list_for`, `MerchantRepository.get_by_owner`, `CourierRepository.get_by_user`.
- [x] 4.2 RED `GET /merchants/mine` and `/delivery/couriers/me` (404 `no_linked_entity`; `mine` before `/{code}`); GREEN.
- [x] 4.3 RED 401/403 tests for payments GET, users/arco GET, reports kpis/financial/audit-logs; GREEN role locks.
- [x] 4.4 RED vitest: anonymous sync calls only public; 403 does not drop zones; empty orders replace mocks; no toast; `App.sync.spec` unchanged green. GREEN: `Promise.allSettled`, gate `/users/arco` admin, `payments`+`audit-logs` accountant/admin.
- [x] 4.5 RED store spec `restaurarSesion` (token -> `GET /users/me`; 401 anonymous; network error keeps tokens); GREEN; call in `main.ts` before sync/`app.use(router)` (`App.spec` mock safe).
- [x] 4.6 Remove offline fake-login fallback (F6) and `c1`/`r2` fallbacks and name matching in MerchantView/CourierView; add `comercioPropio`/`repartidorPropio`, "Cuenta sin comercio/repartidor asignado" empty state (RED component specs).

## PR5: State machine + canonical states
- [ ] 5.1 RED `test_status.py` parametrized transitions, spaced -> 422, blank reason 400, customer 403, merchant out of scope 404, role-target 403, rating non-owner 404, courier-assign scope; GREEN `Literal[8]`, matrix.
- [ ] 5.2 Extend migration with status rewrite (3 UPDATEs, idempotency test); canonical seed + `rechazado` order with reason, fix seed line 369, history canonical.
- [ ] 5.3 RED `test_reports_revenue_excludes_rechazado`; GREEN `reports/repository.py:18`.
- [ ] 5.4 Canonical keys in `mockData.js` (incl. initial mock orders), MerchantView, CourierView, OrdersView, store; `rechazado` in every terminal list (MerchantView:22-23, CourierView:26, store L65, OrdersView:88) and `ESTADO_LABELS`; timeline renders reason (RED component specs).

## PR6: Pricing + codes + method (backend and frontend together)
- [ ] 6.1 RED `test_pricing.py` (tampered price/fee ignored, promo, closed/unaffiliated 400, inactive/unavailable product 400, extra fields ignored); GREEN server recompute.
- [ ] 6.2 RED first order after seed is `PED-1100`, collision retry via monkeypatched `next_code`; GREEN max+1 for `PED-`/`TX-`, retry 3x.
- [ ] 6.3 RED `tarjeta` 422; GREEN `Literal["contr_entrega","yappy"]`; seed cycle.
- [ ] 6.4 Store: send `yappy`, drop price/fee/name fields, map `promo_price`, label "Pago electrónico (simulado)" (RED store spec).

## PR7: Payments
- [ ] 7.1 RED `test_payments.py` (amounts from order, duplicate 409, other's order 404, flag-off ignores `simulate_failure`, legacy `tarjeta` readable, fallido cancels order, receipt owner); GREEN.
- [ ] 7.2 RED vitest `crearPedido` calls orders then payments, anonymous redirect keeps cart; GREEN async; modal single "Pagar (simulado)".

## PR8: Writes
- [ ] 8.1 RED `errors.spec` `toWriteError`; GREEN `services/errors.ts`.
- [ ] 8.2 RED store specs failed write restores snapshot + toast, success path, cart cleared on success only; GREEN helper for all writes; fix F5 auto-dismiss; no `.catch(()=>{})`.

## PR9: Consent/ARCO
- [ ] 9.1 RED `test_consent.py` (latest by id, revoke -> 403 `consent_required` on both POSTs, re-grant, ARCO own list, Literal 422); GREEN `require_active_consent`, endpoints.
- [ ] 9.2 RED ProfileView spec; GREEN consent checkbox, ARCO history, rollback.

## PR10: Guards, flag, Docker, e2e
- [ ] 10.1 RED `guards.spec.ts` (anon redirect, wrong role, `//evil.com`/`https:` rejected, login-page redirect); GREEN `guards.ts`, `main.ts` install, `setSessionExpiredHandler`.
- [ ] 10.2 RED `TopBar.spec.ts` (`vi.stubEnv`); GREEN `config.ts` `DEMO_SWITCHER`, TopBar, "Iniciar sesión".
- [ ] 10.3 `vite-env.d.ts` typing, root Dockerfile `ARG/ENV` before build, `docker-compose.override.yml`, `.env.development`; document override vs `-f docker-compose.yml`.
- [ ] 10.4 `e2e/guards.spec.ts` real-browser: anonymous `/panel-admin` -> `/login?redirect=%2Fpanel-admin`; mocked login returns to target; landing e2e stays green.

## Verification (one-time, after PR10 or per-PR as noted)
- [ ] V.1 Before merging PR2 and PR5: `docker compose up` against the EXISTING Postgres volume; confirm columns, links, advisory lock path, 4 workers no-op, statuses rewritten (PG-only, untested in SQLite).
- [ ] V.2 `docker compose build api web`; confirm `.venv`/tests absent in api image.
- [ ] V.3 Real-browser guard check on compose (all 5 demo logins).

Resolved 2026-11-20 (user): size exceptions for PR4, PR5 and PR6 ACCEPTED; auto mode for all 10 PRs (stacked into develop, merge commits); failed simulated electronic payment auto-cancels the order (default, covered by a PR7 test).
