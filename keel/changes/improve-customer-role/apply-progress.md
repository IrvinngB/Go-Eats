# Apply progress: improve-customer-role

## PR1 (tasks 1.1-1.5) - DONE, not committed
Branch: feat/customer-pr1-backend-harness (stacked, base develop).

### Working commands (reuse in later PRs)
- Create venv (NEVER default python3 = 3.14): `python3.12 -m venv backend/.venv`
- Install: `backend/.venv/bin/pip install -r backend/requirements-dev.txt`
- Run tests: `cd backend && .venv/bin/pytest -q` (focused: `.venv/bin/pytest -q tests/test_x.py::test_y`)
- Frontend gates: `pnpm test`, `pnpm exec vue-tsc -b` (then `git checkout tsconfig.app.tsbuildinfo`)

### Files
- backend/requirements-dev.txt, backend/pytest.ini (pythonpath=., testpaths=tests)
- backend/tests/{__init__,conftest,factories,test_smoke}.py
- backend/.dockerignore; .gitignore (+`.pytest_cache/`, `backend/.venv`)

### Harness notes
- conftest sets DATABASE_URL=sqlite:// before importing app; per-test StaticPool in-memory engine; `db` and `client` fixtures; get_db overridden; TestClient used WITHOUT context manager (no lifespan/seed). Tables are empty per test.
- Factories take a Session: make_user/zone/merchant/courier/product(db, ...), auth_headers(user). PASSWORD_HASH is bcrypt of DEFAULT_PASSWORD ("Passw0rd!").
- Merchant/Courier/Product link by zone_slug / merchant_code strings (no FKs). Defaults: zone "zona-test", merchant "M-TEST".
- Known warning: Pydantic serializer warning on UserRead.role (str vs enum); pre-existing, harmless.

### TDD evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.3 | tests/test_smoke.py::test_health_ok | integration | n/a (no tests existed) | fail: `fixture 'client' not found` | pass | n/a (smoke) | none |
| 1.4/1.5 | test_smoke.py::test_login_with_factory_user, test_precomputed_hash_matches_default_password | integration/unit | n/a | (fixtures/factories absent) | pass | ok+bad password, hash right/wrong | none |
| 1.5 | test_smoke.py::test_no_goeats_db_created | integration | n/a | - | pass (file absent before and after) | existed-before == exists-after | none |

Note: 1.4 factories were written together with 1.5 tests in one step (strictly, tests then code ordering was for 1.3 only).

### Docker proof
`docker build -f backend/Dockerfile backend -t goeats-api-check` OK; `ls -a /app` = .dockerignore, Dockerfile, alembic, alembic.ini, app, requirements.txt. No .venv/tests/requirements-dev.txt/pytest.ini. Image removed.

### Remaining: PR2..PR10


## PR2 (tasks 2.1-2.4) - DONE, not committed
Branch: feat/customer-pr2-migration-link (stacked on PR1). Additive only: no status rewrite, no `rechazado`, no auth/orders/frontend/reports changes.

### Files
- NEW backend/app/core/migrations.py (`run_startup_migrations(engine)`: PG `pg_advisory_xact_lock(724001)`, inspector add-column inside a SAVEPOINT with duplicate-column catch, `CREATE UNIQUE INDEX IF NOT EXISTS`, email backfill only where NULL and user not already linked, INFO counts)
- NEW backend/app/shared/entity_links.py (`ENTITY_LINKS`; emails/codes verified against seed.py: identical to Q1, no fix needed)
- MOD merchants/models.py (`owner_user_id`), delivery/models.py (`user_id`): nullable, unique, indexed, FK users.id (ix_merchants_owner_user_id / ix_couriers_user_id)
- MOD main.py, init_db.py: create_all -> run_startup_migrations -> seed (reseed.py inherits via init())
- MOD seed.py: `_linked_user_id` sets links on fresh DB
- NEW tests/test_migrations.py (8 tests)

### TDD evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 2.1 | test_migrations.py::test_adds_columns_links_idempotent | integration (SQLite legacy DDL) | 5 PR1 tests green | collection error: no module app.core.migrations | pass | run twice; 8 links; c5/r5 unlinked; statuses untouched; plus backfill_leaves_existing_links_alone, unlinked_user_gets_no_link, info_log_counts | comment fix |
| 2.2 | test_entity_links_match_seed_emails | unit | - | fail (no entity_links) | pass | merchants + couriers | none |
| 2.3 | test_fresh_seed_links_entities, test_fresh_schema_noop, test_second_startup_is_noop_and_statuses_untouched | integration | - | fail (no columns/migration) | pass | fresh seed, fresh schema x2, second startup | none |
| 2.4 | test_seeded_users_have_consent_rows | integration | - | n/a (verifies existing behavior; green immediately) | pass | 25 users == 25 accepted consents | none |

Note: tests and implementation were written in one pass; RED was demonstrated by the collection error on the missing module for the whole file.

### 2.4 result
seed.py adds `DataConsent(accepted=True)` for every newly created user (all 25). Verified by test: 25 users, 25 accepted consents. Caveat: pre-existing users are not given consent rows (unchanged behavior).

### Real PostgreSQL verification (postgres:16-alpine, container goeats-pg-migcheck, port 55432, removed after; project containers/volume untouched)
- Legacy schema = create_all then DROP INDEX/COLUMN of the two link columns; 9 seed-email users, c1-c5, r1-r5.
- 4 concurrent processes on a wall-clock barrier: exactly one logged "merchants linked: 4 / couriers linked: 4", the other 3 logged 0; no errors.
- Asserted columns, unique indexes, FKs to users.id, 8 links correct, c5/r5 NULL.
- Two more sequential runs: no-op.
- Fresh DB: drop_all then `init()` twice: ok, links set for c1-c4 / r1-r4.
- NOT proven: V.1 against the EXISTING project volume (stays open).
- `docker build -f backend/Dockerfile backend -t goeats-api-check` OK, image removed.

### Gates
backend pytest 13 passed; `pnpm test` 273 passed; `pnpm exec vue-tsc -b` clean (tsbuildinfo restored).

### Remaining: PR3..PR10 (and V.1/V.2/V.3)


## PR3 (tasks 3.1-3.4) - DONE, not committed
Branch: feat/customer-pr3-auth-hardening. Auth hardening only.

### Files
- MOD backend/app/core/config.py (`env_flag`, `dev_role_override`, `dev_simulate_failure`: env only, 1/true/yes, default OFF)
- MOD backend/app/domains/auth/service.py (login uses `user.role`, `payload.role` only honored with the flag; register forces customer; refresh uses DB role, still rejects missing/suspended users)
- MOD backend/app/domains/users/schemas.py (`UserCreate.role` removed -> extra body field ignored; `accepts_privacy_policy` required, no default)
- NEW backend/tests/test_auth.py (18 cases incl. parametrized flag parsing)
- MOD src/views/LoginView.vue (role picker removed, navigates by `store.rol`, consent checkbox only in register mode and only required there)
- MOD src/stores/useGoEatsStore.js (no `role` in login/register payloads, consent default false, `rol = data.user.role`; offline fallback keeps `rolLocal` only for the old local fallback, removed in a later PR per "No offline fake login")
- NEW src/views/LoginView.spec.ts (6 tests)

### TDD evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 3.1 | test_auth.py::test_login_ignores_role_flag_off, test_login_honors_role_flag_on, test_flags_default_off, test_flag_parsing | integration/unit | 13 green | `'admin' == 'customer'` (override honored); AttributeError no `dev_role_override`; ImportError env_flag | pass | flag on/off, no role, header/query/body cannot enable, 7 parse values | none |
| 3.2 | test_register_role_admin_becomes_customer, test_register_requires_consent_field, test_register_consent_false_rejected | integration | - | admin role created (`'admin' == 'customer'`); missing consent got 200 not 422 | pass | role admin ignored, field missing 422, false 400 | none |
| 3.3 | test_refresh_uses_db_role, test_refresh_picks_up_role_changed_after_issue, test_refresh_suspended_user_rejected | integration | - | claim role returned instead of DB role | pass | forged claim, role changed after login, suspended 401 (suspended already passed: existing behavior pinned) | none |
| 3.4 | LoginView.spec.ts (6) | component+store | 273 green | payload had `role`, picker present, route by chosen role, consent default true | pass | customer, merchant, login w/o checkbox, register gating, demo switch payload, register default | test mock needed `tokenStorage` (first merchant test passed vacuously via offline fallback until fixed) |

### Notes
- "Admin-only endpoint" probes use `GET /users/` (the only locked admin route today); `/users/arco` is still open until PR4.
- Demo switcher: TopBar `CUENTAS_DEMO` roles verified equal to seeded stored roles (carlos customer, hector merchant, maria/javier courier, contabilidad accountant, admin admin); logs in by email+password; no mapping fix needed. TopBar still routes by `cuenta.role` (equals server role for seeds).
- Real check (throwaway sqlite in scratchpad, uvicorn :8765, vite dev :5199 with VITE_API_URL, Playwright script outside repo): login role=admin as carlos -> customer token claim; register role=admin -> customer; register w/o consent -> 422; browser: login page has no picker/checkbox, Entrar -> /tiendas, switcher to admin -> /panel-admin, to merchant -> /panel-comercio, POST bodies carried no `role`. Servers stopped by PID.
- Not verified: with DEV_ROLE_OVERRIDE=1 in a real server (covered by pytest monkeypatch only); post-login redirect param (later PR); offline fake login still exists (later PR).
- Gates: pytest 31 passed; pnpm test 279 passed; vue-tsc clean; build ok; e2e 19 passed.

### Remaining: PR4..PR10


## PR4 (tasks 4.1-4.6) - DONE, not committed
Branch: feat/customer-pr4-scoped-reads. Size exception (~600 lines) accepted: backend and frontend ship together.

### Files
Backend: MOD orders/{router,service}.py (`OrderService.list_for`, `get_order_for`, filters only narrow), merchants/{repository,service,router}.py (`get_by_owner`, `GET /merchants/mine` before `/{code}`), delivery/{repository,service,router}.py (`get_by_user`, `GET /delivery/couriers/me`), payments/router.py (GET admin+accountant), users/router.py (`GET /users/arco` admin), reports/router.py (kpis, financial, audit-logs admin+accountant). Tests: NEW tests/test_orders_scope.py, tests/test_linked_entity_and_locks.py; MOD tests/factories.py (`make_order`, `link_merchant`, `link_courier`).
Frontend: MOD src/stores/useGoEatsStore.js (allSettled sync with role gating, `comercioPropio`/`repartidorPropio`, `restaurarSesion`, offline fake login and `rolLocal` removed, logout clears links), src/main.ts (async bootstrap: restaurarSesion before sync/router), MerchantView.vue and CourierView.vue (linked entity, empty states, no c1/r2/name matching). Tests: NEW src/stores/useGoEatsStore.spec.ts (21), MerchantView.spec.ts (3), CourierView.spec.ts (3).

### Decisions
- Policy per spec: no role is "wrong" for GET /orders/{code} (all roles are in the table), so no 403 there; out-of-scope (incl. unlinked merchant/courier) -> 404. 403 applies to `mine`/`me` and the locks.
- Query params `merchant_code`/`courier_code` narrow (AND) any role's scope, never widen.
- Private lists (orders, payments, arco, audit) replace local data on any fulfilled array, including empty; fulfilled `mine`/`me` sets the link; only 404 or a foreign role clears it, transient failures keep it.
- Sync decides anonymous from `this.autenticado`, never tokenStorage (App.sync.spec mock has none).
- Views resolve the link against the synced lists; if the entity is missing the empty state shows (no fallback).

### TDD evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.1 | test_orders_scope.py | integration | 31 green | list returned all orders / anon 200 instead of 401, other-order GET 200 instead of 404 (14 failed for the right reason after fixing my `/api/v1` prefix) | pass (2 narrowing tests failed first: filters ignored for non-admin; fixed to AND-narrowing) | customer/merchant/courier/unlinked x2/admin/accountant, other-order 404, nonexistent 404, filters per role | single scope path |
| 4.2 | test_linked_entity_and_locks.py (mine/me) | integration | - | `/merchants/mine` captured by `/{code}` ("Merchant not found") | pass | linked, unlinked `no_linked_entity`, 4 foreign roles 403, anon 401, `/{code}` still works, no owner/user id exposed | none |
| 4.3 | same file (locks) | integration | - | 35 failed in total (anon 200, customer 200) | pass | 5 endpoints x 5 roles + anon | none |
| 4.4 | useGoEatsStore.spec.ts (sync) | store | 279 green | 18 of 21 failed (private calls for anonymous, `comercioPropio` undefined) | pass | anonymous, 5 role gates, 403 keeps public data, empty replaces, outage no toast, mine/me linked and 404 | removed unused var, link survives transient failures |
| 4.5 | useGoEatsStore.spec.ts (restaurarSesion) | store | - | `restaurarSesion is not a function` | pass | no token, ok, 401 clears, network error keeps tokens | none |
| 4.6 | store (login/logout), MerchantView.spec.ts, CourierView.spec.ts | store+component | - | fake login `ok:true`; views rendered c1/r2 panel (6 failed) | pass | unlinked, dangling link id, linked by id not name | test fix: empty state has an h1 too |

### Real verification (throwaway sqlite scratchpad/pr4.db seeded via init_db; uvicorn :8766; vite :5201 with VITE_API_URL; Playwright scratchpad/pr4.mjs; real login form; servers stopped by PID, ports confirmed free; goeats.db never created)
API == UI order counts: customer Carlos 12 (only his), merchant Hector 10 (only c1), courier Maria 11 (only r2), accountant 60, admin 60. Anonymous curl `GET /orders/` -> 401, `GET /payments/` -> 401. Anonymous /tiendas requested only zones, merchants, couriers, products. Private calls per role matched the matrix (customer: orders; merchant +mine; courier +me; accountant +payments,audit-logs; admin +users/arco), all 200. Reload on each panel kept the session (`/users/me` 200) and the same data. Two extra unlinked users inserted in the scratch DB: merchant and courier show the empty state (`mine`/`me` 404). Screenshots read: merchant, courier, unlinked merchant, admin, accountant, customer (scratchpad/pr4-*.png).

### Gates
pytest 100 passed; `pnpm test` 306 passed; vue-tsc clean; build ok; e2e 19 passed; tsbuildinfo restored.

### Not verified / pre-existing
- Anonymous TopBar still shows the mock user "Carlos Andrade / Cliente" (guards are PR10); AdminView KPI cards are mockData. Both pre-existing.
- PostgreSQL/Docker path (SQLite only); restore on network error covered by unit test only (backend not killed in the browser).

### Remaining: PR5..PR10 (and V.1/V.2/V.3)


## PR5 (tasks 5.1-5.4) - DONE, not committed
Branch: feat/customer-pr5-states. Size exception (backend + frontend together) accepted. Actual size: ~1,045 changed lines (approx. 245 production, 800 tests; forecast was ~550, tests are the overrun).

### Files
Backend: MOD orders/{schemas,service,router}.py (`OrderStatus` Literal[8]; `VALID_TRANSITIONS` canonical only, rechazado/cancelado from any non-terminal; `ROLE_TARGETS`; `update_status/assign_courier/rate_order` take the caller and resolve the order with `get_order_for` (404 out of scope); rating now customer-only), core/migrations.py (`LEGACY_STATUS_MAP`, `_rewrite_statuses` on orders.status and order_status_history.previous_status/new_status, INFO `statuses rewritten: N`), seed.py (canonical cycle and courier set, one `rechazado` order PED-1049 with reason and history row, payment `fallido`), reports/repository.py (`not_in(cancelado, rechazado)`). Tests: NEW tests/test_status.py (141 cases), tests/test_reports_revenue.py (3); MOD tests/test_migrations.py (+9, legacy status assertions updated; the accent-less legacy fixture value now uses the real `en preparación`).
Frontend: MOD mockData.js (canonical keys, `ESTADOS_TERMINALES`, `rechazado` label, initial mock orders), store (terminal list, `rechazarPedido` stores AND sends `rechazado`), MerchantView, CourierView, OrdersView, landing/HeroVisual.vue (its steps used the spaced keys; not in the blast-radius list, found by running the suite). Tests: NEW src/mockData.spec.ts (5), src/views/customer/OrdersView.spec.ts (8); MOD store spec (+5), MerchantView.spec (+8), CourierView.spec (+5).

### Decisions / deviations
- Courier may also set `cancelado` (design table, and the existing "Reportar problema" button sends it); the task prompt listed only en_camino/entregado. Followed the design to avoid breaking that button. Courier cannot set `rechazado`.
- Check order in `update_status`: role gate (403 customer/accountant) -> scope (404) -> role target (403) -> transition (400) -> reason (400). A wrong role target on an order out of scope is 404.
- Assign courier: nonexistent, unavailable or non-active courier stays 400 (existing RF-01 behavior).
- Admin loses rating (403) per spec; reason is stripped before storing.
- Merchant UI: "Rechazar" now offered in pendiente, confirmado and en_preparacion (spec: reject late); en_camino/listo have no reject button (backend would allow it). Merchant history shows the reason under the badge.
- Seed `rechazado` order is PED-1049 (index 9, another customer than Carlos). On an existing DB the seed skips (>= 40 orders) so no rechazado row is added (test `test_seed_on_existing_db_does_not_add_rechazado`); `python -m app.reseed` (drops data) is the optional way.
- Migration still only maps accented/spaced legacy values (3 entries). The accent-less `en preparacion` is not in the spec map and is left alone.

### TDD evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 5.1 | tests/test_status.py | integration | 100 green | 24 failed first: spaced `en preparación` returned 200 (`assert 200 == 422`), `en_preparacion -> rechazado` got 400 not 200, wrong-role targets got 200 not 403, foreign courier assign got 200 not 404, non-owner/admin rating 200 not 404/403 | 141 pass | full 8x8 matrix, 6 spaced/unknown values, 3 states x 2 targets x 3 blank reasons, 5+6 role/target cases, scope 404 (m2, unlinked, k2, unassigned), courier assign 400 x3 | none |
| 5.2 | tests/test_migrations.py | integration (SQLite legacy DDL + fresh seed) | 12 green | rewrite left `en preparación`, no `statuses rewritten` log, seed audit found `listo para recoger` | 17 pass | map on orders+history, second run no-op (log 0), canonical untouched, missing tables, seed rechazado+reason+history, courier states, no rechazado on existing DB | none |
| 5.3 | tests/test_reports_revenue.py | integration | 249 green | `assert 115.0 == 15.0`, `117.5 == 17.5`, endpoint 115.0 | 3 pass | repo x2, kpis endpoint | none |
| 5.4 | mockData.spec, store spec, Merchant/Courier/OrdersView specs | unit + component | 306 green | 28 failed against the old sources (stashed): old keys, rechazarPedido stored `cancelado`, no `rechazado` label/terminal, no timeline step markers | 337 pass | every state per view, terminal lists, spaced states offer nothing, reason/no reason, tracking only in 3 states | specs moved store data into mount (`setup(link, pedidos)`) after a sync-read flake |

### Real verification (all throwaway, scratchpad; goeats.db never created; project containers untouched)
- (a) SQLite legacy: `git show HEAD:backend/app/seed.py` seed (60 orders: en camino 8, en preparación 7, listo para recoger 8, ...; 60 history rows) -> migration -> counts identical, 0 spaced strings in orders/history, second run identical. Scripts: scratchpad/pr5_legacy.py (+ legacy_seed.py).
- (b) PostgreSQL 16 (container goeats-pg-migcheck on :55432, removed after): same legacy seed; 2 concurrent processes on a wall-clock barrier: one logged `statuses rewritten: 46` (23 orders + 23 history cells), the other 0, no errors, counts 60/60, no spaced values; third sequential run rewrote 0. Also drop_all + new `init()` twice on PG: canonical seed, 1 rechazado (PED-1049) with its reason, history canonical.
- (c) Real UI (uvicorn :8767 + vite :5202, fresh sqlite pr5.db, Playwright scratchpad/pr5.mjs, real login form, full reload after login): merchant Hector confirmed -> en preparación -> listo para recoger on PED-2001, assigned courier r2 from the select; courier María en camino -> entregado; customer Carlos timeline (screenshot: step 5 highlighted, earlier done, courier card) and after entregado; PED-2002 rechazado through the modal (button disabled while the reason is blank) with reason; customer sees "Rechazado: Sin insumos para este pedido" with no timeline. API checked after every step; history rows: pendiente->confirmado->en_preparacion->listo_para_recoger->en_camino->entregado (actors merchant:15 / courier:20) and pendiente->rechazado with the reason; 0 spaced strings in DB; no pageerror and no 4xx/5xx during the walk. Screenshots read: scratchpad/pr5-{m2-asignado,k1-en-camino,m3-rechazado-historial,c1-timeline-en-camino,c3-timeline-rechazado}.png. Servers stopped, ports confirmed free.
- The test orders PED-2001/2002 were inserted directly in the scratch DB: `POST /orders/` on a seeded DB still collides with PED-1061 (known defect, PR6 task 6.2).

### Gates
backend pytest 252 passed; `pnpm test` 337 passed (32 files; router/App/App.sync/LandingView specs untouched and green); vue-tsc clean; `pnpm build` ok; `pnpm test:e2e` 19 passed (landing* unchanged); tsbuildinfo restored.

### Not verified
- V.1 against the existing project Postgres volume (docker compose) stays open; PG was tested on a throwaway container with a seeded legacy DB, not on the real volume.
- Customer cancel/reject flows through the courier "Reportar problema" button were covered by component test only, not clicked in the browser.
- No mobile viewport screenshots of the new timeline/terminal box.
- Write failures are still silent in the store (`.catch(() => {})`, PR8): e.g. a 403 target error would leave the optimistic local state.

### Remaining: PR6..PR10 (and V.1/V.2/V.3)
