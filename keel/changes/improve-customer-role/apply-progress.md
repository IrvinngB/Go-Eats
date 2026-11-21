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


## PR6 (tasks 6.1-6.4) - DONE, not committed
Branch: feat/customer-pr6-pricing. Size exception (backend + frontend together) accepted.

### Files
Backend: NEW shared/codes.py (`next_sequence`/`next_code` = max numeric suffix + 1 with floor, `MAX_ATTEMPTS=3`, `CodeGenerationError`); MOD orders/{schemas,repository,service}.py (OrderCreate = merchant_code, zone_slug, delivery_address, notes, `payment_method: Literal["contr_entrega","yappy"]`, items [{product_code, quantity 1..50, notes}]; extras dropped; service validates merchant/zone/products and recomputes price, name, fee, names, phone; repository inserts with 3x retry on IntegrityError), payments/{schemas,repository,providers}.py (Literal; TX- generation + REC number from same seq with retry; default channel `yappy`), catalog/repository.py (`get_by_code`), main.py (`CodeGenerationError` -> 503), seed.py (methods_cycle `["yappy","contr_entrega"]`). Tests: NEW tests/test_pricing.py, test_codes.py, test_payment_method.py.
Frontend: MOD store (sync maps effective `precio` = promo_price>0 else price, keeps `precioRegular`; `crearPedido` payload trimmed, wire `yappy`/`contr_entrega`), StoreDetailView.vue (label "Pago electrónico (simulado)", effective price + struck-through regular price with data-test hooks), OrdersView.vue (label). Tests: store spec (+6), NEW StoreDetailView.spec.ts (3).

### Decisions / deviations
- Delivery fee uses the tariff of the ORDER's `zone_slug` (spec "order's zone", and it is what the UI shows via zonaActual), not the merchant's zone; zone must exist and be active. `calculate_delivery_fee` (distance ignored) is reused.
- Nonexistent merchant is 400 (spec) not 404 (design table).
- Exhausted retries (3 collisions) return 503 "Could not allocate a code" through an app exception handler, never a bare 500.
- Seed: max seeded order is PED-1099 and payment TX-9060, so first real codes are PED-1100 / TX-9061. Existing DB rows with `tarjeta` are untouched (no data migration); seed methods now cycle only the two valid ones.
- Payments create still takes client amounts (PR7 rewrites it); only the method Literal and unique code changed there. Provider ref prefix PGF is now only reachable for unknown legacy channels.
- Frontend UI id stays `electronico`; only the wire value is `yappy`. No payments call (PR7) and error surface / rollback unchanged (PR8).
- Product lookup by exact `code` (new `get_by_code`), not `get_by_id_or_code`, so a numeric string never matches a row id.

### TDD evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 6.1 | tests/test_pricing.py | integration | 252 green | 19 failed: 422 on missing name/unit_price/fee (client fields required), inactive checks absent, price not from catalog | 295 pass | tamper price/fee/totals/names, promo >0, promo 0 fallback, distance 99km ignored, price change later, multi item totals, closed, 3 affiliation states, schedule ignored, unknown merchant/zone/inactive zone/product, other merchant product, unavailable, qty 0/-1/51, empty items, stored rows | none |
| 6.2 | tests/test_codes.py | integration | - | collection ImportError (`app.shared.codes` missing); then 6 failed | pass | empty DB 1001, seeded PED-1100, gaps (1005,1003 -> 1006), non-numeric suffix ignored, monkeypatched collision retried -> PED-1002 (2 calls), exhausted -> 503 and no extra row, TX max+1 with REC match, TX floor, TX collision retry | none |
| 6.3 | tests/test_payment_method.py | integration | - | `POST /payments/` with `tarjeta` returned 201; valid order bodies 422; seed produced `tarjeta` | pass | tarjeta/paypal/empty/YAPPY 422 on order, both valid methods, payment Literal x3, legacy tarjeta order and payment still 200, fresh seed only 2 methods | none |
| 6.4 | useGoEatsStore.spec.ts, StoreDetailView.spec.ts | store + component | 337 green | 7 failed: payload had names/prices/fee and `tarjeta`, precio stayed 5 with promo 4, no `precioRegular`, label lacked "(simulado)", no price hooks | pass (346) | electronic and cash payloads exact (toEqual / key list), promo 4, null and 0 promo, struck-through only when regular > effective | none |

### Real verification (throwaway sqlite scratchpad/pr6.db seeded via init_db; uvicorn :8768; vite :5203 with VITE_API_URL; Playwright scratchpad/pr6.mjs; real login as carlos@ejemplo.pa; goeats.db never created)
Promo p1 of c1 set to 5.50 (regular 6.50) and merchant c7 closed directly in the scratch DB (seed has no promos). Through the real UI: menu shows B/ 5.50 with B/ 6.50 struck through; 2 x p1 with cash on delivery -> PED-1100, then electronic (simulated approval) -> PED-1101; both 201, no 4xx/5xx, no pageerror. Request bodies captured by Playwright: no name/price/fee fields, `yappy` and `contr_entrega` on the wire. Stored: subtotal 11.00, fee 2.50, total 13.50 (checkout panel showed the same 11.00 / 2.50 / 13.50). curl: tampered (price 1, fee 0, total 0.01, fake names) -> PED-1102 with real price 8.25, fee 2.50, total 10.75, names Carlos Andrade / Restaurante Diablicos; `tarjeta` -> 422; closed c7 and unaffiliated c8 -> 400 "Merchant is not accepting orders (closed or not active)."; product of another merchant -> 400. Screenshots read: scratchpad/pr6-menu-promo.png, pr6-checkout-electronico.png. Servers stopped by PID.

### Gates
backend pytest 295 passed; `pnpm test` 346 passed (33 files; router/App/App.sync/LandingView and PR4/PR5 suites untouched and green); vue-tsc clean; `pnpm build` ok; `pnpm test:e2e` 19 passed; tsbuildinfo restored.

### Not verified
- PostgreSQL / project docker volume (SQLite only). The retry path uses the generic IntegrityError; real concurrent collisions were simulated by monkeypatch, not by parallel requests.
- Payments call and payment modal outcome are still local (PR7); the order created in the UI is local-first and the POST error is still swallowed (PR8).
- No mobile viewport screenshots.

### Remaining: PR7..PR10 (and V.1/V.2/V.3)


## PR7 (tasks 7.1-7.2) - DONE, not committed
Branch: feat/customer-pr7-payments.

### Files
Backend: MOD payments/{schemas,service,router,repository}.py (`PaymentCreate` = `order_code`, `method` Literal, `simulate_failure`; client amounts/names/card fields dropped by pydantic; amounts and names from the persisted order; POST = customer only, other's/unknown order 404, admin and other roles 403; order must be `pendiente` and method equal to the order's (400); active `pagado`/`pendiente` payment -> 409; `simulate_failure` honored only if `settings.dev_simulate_failure`; `fallido` electronic -> payment fallido + order `cancelado` with reason "Pago electrónico rechazado", history actor `sistema:pago`; payment history actor `customer:<id>`; receipt: customer must own the order (404 otherwise), admin/accountant any, merchant/courier 403), orders/{models,schemas}.py (read-only `payment_status` = latest payment status via column_property, null while unpaid). Tests: NEW tests/test_payments.py (24 cases), MOD test_payment_method.py (payment create now uses the new body).
Frontend: MOD store (`crearPedido` async: POST /orders -> POST /payments `{order_code, method}`; local `simularPago` and local order id removed; `mapPedidoApi`/`mapTransaccionApi` extracted, `pagoEstado` mapped), StoreDetailView.vue (electronic: modal with the single "Pagar (simulado)" action that runs crearPedido; result states aprobado/rechazado/error with server reference; cash uses the same call; anonymous -> login with `redirect=/tiendas/<id>`, cart kept), OrdersView.vue (payment status line from API). Tests: store spec, StoreDetailView.spec (+5), OrdersView.spec (+4).

### Decisions / deviations
- Electronic checkout: the order is created only when the user presses "Pagar (simulado)" (no unpaid orphan order); both calls run inside crearPedido.
- A failed electronic payment cancels the order (user-confirmed), so the spec scenario "retry after failure" is only reachable for a non-cancelled order; UI tells the user to re-order with cash.
- Server approval does not confirm the order (stays `pendiente` until the merchant confirms); the old local "confirmado" was dropped.
- `payment_status` added to OrderRead so the customer sees payment status after reload (customer cannot GET /payments/).
- Consent gate is PR9, not done. Write rollback/typed errors are PR8: failures only notify generically; order failure keeps the cart.
- `get_payment_provider` still falls back to the simulated channel for unknown methods (design said raise; not needed since the Literal blocks it).

### TDD evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 7.1 | tests/test_payments.py | integration | 295 green | 19 of 24 failed: `assert 422 == 201` (client subtotal/fee/names required), tampered amount `1.0 != 10.0`, no `payment_status` | 319 pass | tamper, cash/electronic, other 404, unknown 404, 4 roles 403, anon 401, dup x2 methods, method mismatch, non-pending, flag off/on/on-without-flag, cash never fails, history create+reconcile+failed, card fields, legacy tarjeta, receipt 6 roles | none |
| 7.2 | useGoEatsStore.spec.ts, StoreDetailView.spec.ts, OrdersView.spec.ts | store + component | 346 green | store 5 failed (only /orders/ called, no pagoEstado, null cases returned local order); view crashed on `toFixed` of undefined (sync crearPedido); OrdersView 3 failed without the status line | 360 pass | both methods, failed payment, order failure, anonymous, single modal button, approved/rejected, cash, 3 statuses + none | none |

### Real verification (throwaway sqlite scratchpad/pr7a.db flag OFF :8771, pr7b.db DEV_SIMULATE_FAILURE=1 :8772, vite :5211/:5212, Playwright scratchpad/pr7.mjs, real login carlos@ejemplo.pa; goeats.db never created)
Through the UI: cash order PED-1100 -> payment TX-9061 pendiente (15.50 = order total); electronic PED-1101 -> modal had exactly one button "Pagar (simulado)", result "Pago aprobado" with reference YPY-..., TX-9062 pagado 15.50; request bodies captured: payments body is only `{order_code, method}`. Reload: Mis pedidos shows Pagado / Pago pendiente. History rows `(null -> status, customer:1)`. Flag OFF via curl: tampered subtotal/fee + `card_number` + `simulate_failure:true` -> pagado with order amounts (6.5+2.5=9.0), duplicate 409, no card string in DB/audit. Flag ON via curl: same body -> `fallido`, order `cancelado` reason "Pago electrónico rechazado", order history `pendiente->cancelado sistema:pago`, retry 400 (order cancelled). UI on the flag-ON backend approves (UI cannot force failure). Accountant GET /payments/ 200, customer 403, admin POST 403. Receipt: owner 200, another customer's 404. Screenshots read: scratchpad/pr7-a-modal-pagar.png, pr7-a-modal-resultado.png, pr7-a-pedidos.png. Servers stopped by PID, ports free.

### Gates
backend pytest 319 passed; `pnpm test` 360 passed (33 files); vue-tsc clean; `pnpm build` ok; `pnpm test:e2e` 19 passed; tsbuildinfo restored.

### Not verified
- Project PostgreSQL / docker volume; receipt PDF content (only status/content-type checked).
- UI failure rendering ("Pago rechazado") only by component test; the browser failure path was exercised through curl, not clicked (the UI deliberately cannot trigger it).
- No mobile viewport screenshots; the checkout screenshots for cash were taken but not Read.

### Remaining: PR8..PR10 (and V.1/V.2/V.3)


## PR8 (tasks 8.1-8.2) - DONE, not committed
Branch: feat/customer-pr8-writes. Frontend only, backend untouched.

### Files
NEW `src/services/errors.ts` (`toWriteError` -> `{kind, status, message (Spanish), code?, detail?}`; kinds network/unauthorized/forbidden/not_found/validation/conflict/server/unknown; no response + axios error/timeout = network status 0; string details shaped like `snake_case` become `code` (consent_required, no_linked_entity get specific messages); 400/422 message appends a string detail). NEW `errors.spec.ts` (12), `useGoEatsStore.writes.spec.ts` (32).
MOD `useGoEatsStore.js`: `notificar(texto, tipo)` fixed (F5) + new `escribir({objetivos, aplicar, llamada, exito, revertir})` helper (snapshot -> optimistic -> await -> on failure restore + typed error toast (`tipo: 'error'`) + `{ok:false, error}`; success `{ok:true, data}`; never throws; local log event and success toasts run only after ok). `App.vue` toast red for `tipo === 'error'`. Views adapted to await the result: MerchantView, CourierView, OrdersView (+2 tests in OrdersView.spec.ts), AdminView, ProfileView (success toast only on ok; modals stay open on failure).

### Every write in the store (rg `.catch(() => {})` / `api.post|patch|put`) and how it is covered
All `.catch(() => {})` removed (0 left). Through `escribir`: avanzarEstadoPedido (merchant/courier/admin status, incl. cancel with reason), rechazarPedido, asignarRepartidor, toggleRepartidorDisponible, actualizarEstadoProducto, guardarProducto (update restores fields, create removes the new item), guardarHorarioComercio, conciliarTransaccion, resolverAfiliacion (approve; reject is local-only, no API), cambiarEstadoComercio, responderARCO (non-numeric ids stay local-only), enviarSolicitudARCO (optimistic item removed on failure), guardarPerfil, calificarPedido. crearPedido: manual typed handling (two calls). autenticarUsuario/auth POSTs keep their own `{ok, mensaje}` contract (login, not an optimistic write). descargarComprobantePDF is a GET with its offline fallback, unchanged.

### Decisions / deviations
- Write actions now return a Promise of `{ok, data|error}` (was undefined). `{ok:false, error:null}` = unknown local id (no call, no toast).
- crearPedido keeps its PR7 return shape (order or null). Cart is cleared only after both calls succeed (before it was cleared after the order POST). If the payment POST fails over HTTP/network the order stays in the list (it exists on the server), the cart is kept, the toast is "El pedido PED-x se creó, pero el pago falló. <typed message>" and it returns null. Risk: retrying creates a second order (no reuse of the created one).
- Local log events (`registrarEvento`) now only on success. Previously logged optimistically.
- 401 on a write: toast "Tu sesión expiró. Inicia sesión de nuevo.", state rolled back, tokens untouched (refresh/expiry hook is PR10).
- Restore is per-object (shallow): two in-flight writes on the same object where the first fails restore the pre-first state.
- No PR4-PR7 spec had to change (all stay green); only OrdersView.spec got new cases.

### TDD evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 8.1 | services/errors.spec.ts | unit | - | suite failed to load: `./errors` module missing | 12 pass | network, timeout, 401/403/404/409/500/503/418, 400 with string detail, 422 list detail, consent_required, no_linked_entity, non-axios throw/string | none |
| 8.2 | stores/useGoEatsStore.writes.spec.ts, views/customer/OrdersView.spec.ts | store + component | 360 green | 30 of 32 failed: `r` undefined (`Cannot read properties of undefined (reading 'ok')`), fake-timer toast stayed `{texto:'Hola', id}` instead of null (F5), cart/message cases failed | 32 pass, then 406 total | 403/404/409/422/400+detail/network/401 on status write, success path, 14 writes rollback, create rollback, unknown id, no unhandled rejections, cart kept on order failure x4 kinds and on payment failure, cleared only on success, notificar timers (older timer, same-ms ids, error style); OrdersView rating fail vs ok | helper extracted from per-action code |
(2 of 32 passed at RED: optimistic-before-answer and the success-keeps-cart case already held; not counted as RED evidence.) After GREEN, 6 tests failed on my own test mistakes (double period in the expected message, seeded orders in the default store) and the tests, not the code, were fixed.

### Real verification (throwaway sqlite scratchpad/pr8.db seeded via init_db; uvicorn :8781; vite :5221 with VITE_API_URL; Playwright scratchpad/pr8.mjs; merchant hector.endara@ejemplo.pa (c1) and customer carlos@ejemplo.pa; goeats.db never created)
Merchant UI: PED-1102 rejected behind the UI's back via API, then the stale UI clicked "Confirmar pedido": backend 400 "Invalid state transition from 'rechazado' to 'confirmado'", card went back to Pendiente, red toast "Los datos no son válidos o la acción no está permitida: Invalid state transition ...", toast gone after 3.3 s with no interaction. Happy path PED-1101: Confirmado, no toast, server status confirmado. Backend killed by PID: confirm on PED-1100 stayed Pendiente, toast "No se pudo conectar con el servidor. ..." and gone by itself. Customer with backend stopped: "Realizar pedido" kept the drawer and cart (subtotal B/ 13.00, total B/ 15.50) and showed the network toast, which disappeared by itself. No pageerror. (First run had only one pending order in the seed; I added three via the customer API and re-ran.) Screenshots Read: scratchpad/pr8-m2-backend-reject-toast.png, pr8-m4-network-toast.png, pr8-c1-cart-survives.png. Servers stopped, ports free.

### Gates
backend pytest 319 passed (untouched); `pnpm test` 406 passed (35 files; router/App/App.sync/LandingView and PR4-PR7 suites unchanged and green); vue-tsc clean; `pnpm build` ok; `pnpm test:e2e` 19 passed; tsbuildinfo restored.

### Not verified
- UI paths for courier, admin, accountant, profile and ARCO write failures (store specs only; views adapted but not clicked in a browser). Rating modal-stays-open by component test only.
- In the browser only the 400 invalid-transition and network cases were exercised; 403/404/409/422/401 by unit tests.
- Payment-HTTP-failure after a created order not reproduced in a browser (store spec only).
- No mobile viewport; real 401 mid-session not exercised (PR10).

### Remaining: PR9, PR10 (and V.1/V.2/V.3)


## PR9 (tasks 9.1-9.3) - DONE, not committed
Branch: feat/customer-pr9-consent-arco.

### Files
Backend: NEW `users/dependencies.py` (`require_active_consent`: customer role only; latest `DataConsent` by highest id; accepted passes; revoked or missing -> 403 `consent_required`; other roles pass through so role errors and admin behaviour are unchanged), MOD `users/{schemas,repository,service,router}.py` (`ConsentRead/ConsentUpdate`, `ArcoType` Literal of the 4 values, `GET/PUT /users/me/consent`, `GET /users/me/arco` own only newest first; PUT appends a row at `settings.privacy_policy_version` and writes an audit event; admin `GET /users/arco` untouched), MOD `orders/router.py` and `payments/router.py` (gate declared AFTER the role dependency, POST only). Tests: NEW `tests/test_consent.py` (28 cases), MOD `tests/factories.py` (`make_user(consent=True)` default + `make_consent`, mirrors register and the seed so the 319 earlier tests keep exercising the happy path).
Frontend: MOD store (`usuario.consentimientoLey81` starts `null` and login/restore no longer set true; `cargarConsentimiento`, `cambiarConsentimiento` via `escribir`; `misSolicitudesARCO` + `cargarMisSolicitudesARCO`; `enviarSolicitudARCO` now targets the own list and swaps in the server row; `guardarPerfil` never overwrites the consent flag; `consentimientoRequerido` flag; `pedidoPendientePago` for 9.3), ProfileView.vue (real toggle, revoked explanation, load-error state, own ARCO history with status and admin response, detail >= 5 chars client check), StoreDetailView.vue (consent_required box with "Ir a mi perfil para aceptar" in the drawer and in the payment modal), LoginView.vue. Tests: NEW `useGoEatsStore.consent.spec.ts` (19), NEW `ProfileView.spec.ts` (11), MOD `StoreDetailView.spec.ts` (+3), `LoginView.spec.ts` (+1), `useGoEatsStore.writes.spec.ts` (1 case updated).

### Decisions / deviations
- Existing DBs: NO backfill. Spec and clarification Q3 say "no record = not accepted" and require nothing else, so I did not invent a silent consent. Consequence: on an existing Postgres volume any customer created before the gate and without a `data_consents` row (registration and the seed always created one, so only hand-made or pre-consent rows) gets 403 `consent_required` on POST /orders and /payments until they tick the box in Perfil. Seeded and registered users are unaffected. Not verified against the project volume.
- LoginView policy button: REMOVED (simplest honest option; no legal text invented). The register checkbox text was reworded from "He leido y acepto la politica" to "Acepto el tratamiento de mis datos ... Ley 81 de 2019 ... Podre revisar y revocar este consentimiento desde mi perfil", since there is no policy document to have read. Spec allows "open or remove".
- Store `usuario.consentimientoLey81` is `null` (unknown) until Perfil loads the server state; nothing outside `cargarConsentimiento/cambiarConsentimiento` sets it true (rg verified: only the logged-out reset and tests).
- PR8 contract change (legit): `enviarSolicitudARCO` writes to `misSolicitudesARCO`, not `solicitudesARCO` (the latter stays the admin-wide list). One PR8 case in `useGoEatsStore.writes.spec.ts` updated accordingly. No other PR4-PR8 spec changed.
- Orders POST still allows admin (`require_roles(CUSTOMER, ADMIN)` from earlier PRs, design table says 403): not touched here; the gate does not apply to admin.
- 9.3 retry-safety: `crearPedido` remembers `{codigo, firma}` after POST /orders succeeds; the signature covers merchant, zone, address, notes, method and every cart line. Same signature on the next call -> POST /orders skipped, only POST /payments for that code. Memory cleared on success (`vaciarCarrito`), on `vaciarCarrito` (cancel/empty), on logout, and implicitly when any cart line or delivery datum changes (signature mismatch -> new order). The abandoned unpaid order of a changed cart stays `pendiente` on the server (no cancel endpoint for customers); known limitation.
- A consent_required on the payment POST after the order was created keeps the memory, so after re-accepting in Perfil the retry only pays.

### TDD evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 9.1 | tests/test_consent.py | integration | 319 green | 18 of 28 failed: `405 Method Not Allowed` on PUT/GET consent and `/me/arco`, `assert 201 == 403` (revoked order and payment not blocked), `201 == 422` for unknown ARCO types | 347 pass | latest by id vs newer timestamp, no record, append/history [T,F,T], same-second flips, other user untouched, login adds no consent, order+payment x (revoked, missing), re-grant, reads still 200 while revoked, nothing deleted, merchant 403 not masked, admin ok, anon 401, ARCO own-only/newest-first/responded, 4 valid types + 4 invalid, short detail, forged user_id ignored, admin list admin-only | factories default consent |
| 9.3 | useGoEatsStore.consent.spec.ts | store | 406 green | named first: "POST /orders is called once across a failed payment and its retry": `expected length 1 but got 2`; 14 of 19 failed in total | 19 pass (425 total) | retry, success clears, cart qty change, empty+re-add, changed address, logout, consent_required on order and on payment, flag cleared on re-grant, consent load/toggle/rollback, own ARCO | none |
| 9.2 | ProfileView.spec.ts, StoreDetailView.spec.ts, LoginView.spec.ts | component | 425 green | ProfileView 11 of 11 failed (`/users/me/consent` never requested, empty DOMWrapper for the toggle); StoreDetailView 2 of 3 failed (no consent box); LoginView: `expected length 0 but got 1` (proved by stashing the view change) | all pass (440 total) | accepted/revoked/off/on/failure rollback/load failure; ARCO list order+labels+response, 4 types, submit, short detail, failed submit; cash drawer and electronic modal + navigation to profile; no box when flag off | none |

### Real verification (throwaway sqlite scratchpad/pr9.db seeded via init_db; uvicorn :8791; vite :5231 with VITE_API_URL; Playwright scratchpad/pr9.mjs; real login carlos@ejemplo.pa; goeats.db never created)
Through the UI: Perfil showed the toggle ON; unchecking sent `PUT {accepted:false}` and showed the revoked note; "Realizar pedido" sent POST /orders -> 403, the drawer showed the specific box + red toast, no order was created; the "Ir a mi perfil para aceptar" link went to /perfil; re-checking sent `PUT {accepted:true}`; back in the store the cart was kept and the same checkout created PED-1100 and POST /payments PED-1100 (body only `{order_code, method}`). ARCO: picked Oposicion, wrote a detail, history showed it first as Pendiente, same after reload; API own list `[11 Oposicion, 1 Acceso]`. A second customer (registered via API) got `[]` from GET /users/me/arco. Consent history in the scratch DB (read-only sqlite3): Carlos has rows 1(accepted) 26(revoked) 27(accepted), later 5 after my curl round-trip: appended, never deleted. Curl while revoked: POST /payments 403 `consent_required`, GET /orders/PED-1100 200. Zero pageerrors. Screenshots Read: scratchpad/pr9-2-profile-revoked.png, pr9-3-checkout-blocked.png, pr9-6-arco.png. Servers stopped by PID, ports 8791/5231 free. No panel degraded (only visual note: the error toast overlaps the drawer's "Realizar pedido" bottom edge, pre-existing toast position).

### Gates
backend pytest 347 passed; `pnpm test` 440 passed (37 files; router/App/App.sync/LandingView and PR4-PR8 suites green); vue-tsc clean; `pnpm build` ok; `pnpm test:e2e` 19 passed; tsbuildinfo restored.

### Not verified
- Project PostgreSQL / docker volume; users of an existing DB without consent rows (behaviour by pytest "missing consent" only).
- Retry-safe `crearPedido` only by store spec (the browser cannot make the payment fail without the DEV flag; the order-then-payment path was exercised with the happy case).
- Electronic-payment modal consent box by component test only (browser run used cash).
- No mobile viewport; admin resolving an ARCO request and the customer seeing `respondida` in the UI only by pytest (API) and component test.

### Remaining: PR10 (and V.1/V.2/V.3)



## PR10 (tasks 10.1-10.5) - DONE except `.env.development` (see below), not committed
Branch: feat/customer-pr10-guards.

### Files
Frontend: NEW `src/guards.ts` (`rutaPorRol`, `safeRedirect(router, raw, rol)` pure allow-list validator, `installGuards(router, store, ready)`, `installSessionExpiry(router, store)`; access table by route NAME inside guards.ts, design path `src/guards.ts`), NEW `src/config.ts` (`DEMO_SWITCHER`), MOD `src/main.ts` (installs guards + expiry; guards await the restore promise), MOD `src/services/api.ts` (`setSessionExpiredHandler`; fires on refresh rejection, or 401 with an access token but no refresh token; never for anonymous calls; a throwing handler never masks the request error), MOD `src/stores/useGoEatsStore.js` (`cerrarSesion(mensaje)` optional toast text, default unchanged), MOD `LoginView.vue` (honors validated `?redirect`, else role home; local role table removed), MOD `TopBar.vue` (anonymous "Iniciar sesion" and no mock user, SERVER role, switcher behind `DEMO_SWITCHER`, demo switch navigates by `store.rol`, not the listed role), MOD `vite-env.d.ts`. Exported `routes` untouched.
Infra: MOD `Dockerfile` (`ARG VITE_ENABLE_DEMO_SWITCHER=false` + `ENV` before `pnpm build`), NEW `docker-compose.override.yml` (web build arg true; backend DEV_* flags left unset per Q7; no "Q11" exists in clarifications), MOD `README.md` (override vs `-f docker-compose.yml`). `docker compose config` (read-only) verified: plain -> arg present; `-f docker-compose.yml` -> no arg.
Backend (10.5): MOD `orders/router.py` (`POST /orders` customer only; rating was already customer only); NEW `tests/test_orders_customer_only.py`. No frontend path relied on admin ordering (only StoreDetailView calls `crearPedido`, customer only).
Tests: NEW `guards.spec.ts` (56), `services/api.spec.ts` (7), `components/TopBar.spec.ts` (13), `e2e/guards.spec.ts` (10), +9 LoginView, +1 store.

### Decisions / deviations
- `.env.development` NOT created: writing it is denied by the permission rules of this environment (both shell and Write tool). I did not work around it. User must create `/Users/Irvinng/Developer/Proyectos/Go-East/.env.development` with `VITE_ENABLE_DEMO_SWITCHER=true`; `.gitignore` does not ignore it (`git check-ignore` empty; only `*.local` is ignored). README documents it. Task 10.3 therefore left unchecked.
- Guards take the store itself (`installGuards(router, store, ready)`), not `getSession` of design ADR8, as the brief asked; `ready` is the restore promise (a rejection counts as anonymous). main.ts still awaits the restore before mounting so the first sync is authenticated.
- Browser URL is `/login?redirect=/panel-admin` (vue-router does not escape `/` in a query value), not `%2Fpanel-admin`; e2e accepts both; semantics identical.
- Authenticated landing `/` stays open to every role (public).
- Expiry toast: "Tu sesion expiro. Inicia sesion de nuevo." (accented in code).
- The bundle of a flag-off build still CONTAINS the switcher template text, `CUENTAS_DEMO` emails and the `demo1234` literal (v-if false, no tree-shaking); it is not rendered (e2e) but not stripped either. LoginView still prefills carlos@ejemplo.pa/demo1234 (design ADR11 mentioned gating the prefill; not in the PR10 brief and the existing LoginView spec relies on it, so untouched).
- Node 26 jsdom: global `localStorage` is not usable in vitest; `api.spec.ts` stubs an in-memory storage.

### TDD evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 10.1 guards | guards.spec.ts | unit (real routes, memory history) | router/LandingView/App specs green | suite failed to load: `./guards` missing | 56 pass | 6 anonymous protected paths, 4 public, catch-all, wrong role x4, admin on 4 customer routes, login-page redirect x5 roles, logout then protected, restore awaited with a deferred promise (nav pending, then decided as admin), rejected restore = anonymous, `safeRedirect` 20 malicious/invalid values (`//evil.com`, `https:`, `javascript:`, `data:`, backslashes, `%2F%2F`, `/%2F`, `/%5C`, tab, space, `///`, `/login`, unknown), array param, unknown role | mutation: removing the anonymous guard in `installSessionExpiry` made its anonymous test fail |
| 10.1 expiry hook | services/api.spec.ts | unit (axios adapter) | - | `setSessionExpiredHandler is not a function` (7 of 7) | 7 pass | refresh rejected, 2 concurrent calls fire once, access-only token, anonymous 401 silent, silent refresh retried, 500 silent, throwing handler | none |
| 10.1 logout msg | useGoEatsStore.spec.ts | store | green | `Expected "Tu sesion expiro..." Received "Has cerrado sesion."` | pass | default + custom | none |
| 10.1 LoginView | LoginView.spec.ts | component | 8 green | 1 of 10 new failed for the right reason: `Expected "/tiendas/c1" Received "/tiendas"` (the other 9 are regression guards that already held: old code ignored `redirect`) | 18 pass | customer target, admin panel, other-role panel, customer route for merchant, 5 malicious values, no redirect, failed login | role table removed |
| 10.2 | components/TopBar.spec.ts | component (`vi.stubEnv` + `vi.resetModules`) | none (no spec existed) | 8 of 12 failed: `Received "GGo EatsExplorarMis pedidosPerfilIInvitado Cliente"` (mock user shown), switcher shown with flag off; then 2 more failed `Expected "/tiendas" Received "/panel-repartidor"` (listed role used) | 13 pass | anonymous label/no menu/no links, server role, flag unset/'false'/'TRUE'/'1'/'yes' hidden, 'true' shows 6 accounts, switch by server role, failed switch no nav | none |
| 10.5 | backend/tests/test_orders_customer_only.py | integration | 347 green | `assert 201 == 403` (admin created an order) | 353 pass | customer 201, admin 403, merchant/courier/accountant 403, anonymous 401, no row created | none |
| 10.4 | e2e/guards.spec.ts | Playwright real Chromium, SW blocked, API via `page.route` | 19 e2e green | first run 3 of 10 failed on the expected URL form (`%2F` vs `/`), a test-expectation error, fixed in the test | 29 pass total | anonymous panel, login returns to target, customer on admin panel (after reload) -> /tiendas, /pedidos redirect, public routes + unknown path, `//evil.com`, authenticated at /login, switcher absent (flag off), mid-session refresh rejected -> /login?redirect=/perfil, anonymous 401 sync silent | none |
(10.2/10.3 note: the new e2e "demo switcher absent" runs on the default `pnpm build`.)

### Real verification (throwaway sqlite scratchpad/pr10.db seeded via init_db; uvicorn :8801; vite dev :5241 with VITE_API_URL; Playwright scratchpad/pr10.mjs and pr10-exp.mjs; goeats.db never created; docker never started)
Through the real login UI with all 5 demo roles (carlos, hector.endara, maria.cedeno, admin, contabilidad): anonymous `/pedidos` or panel -> `/login?redirect=...`; each login landed on the requested role-valid target (customer `/pedidos`, merchant `/panel-comercio`, courier `/panel-repartidor`, admin `/panel-admin`, accountant `/panel-contabilidad`). Each panel loaded its own data with zero API >= 400 and zero pageerrors (merchant: Diablicos orders; courier: Maria's 2 assignments; accountant: transactions + volume; admin: affiliations/KPIs; customer: Carlos' orders). Wrong-role navigation by full reload: customer -> /tiendas for all 4 panels; each non-customer -> own home for the other 3 panels and /pedidos and /perfil. Reload on the home kept the session and the navigation list during reload never contained /login (guard waited for restore). Authenticated at /login and unknown path -> role home (customer /tiendas). Logout -> /login, tokens null, protected route -> /login?redirect=<home> (customer home is public /tiendas). Expiry against the REAL server: access token replaced by garbage with a valid refresh -> silent refresh, stayed on /perfil, token replaced; both tokens garbage -> `POST /auth/refresh` 401, tokens cleared, toast "Tu sesion expiro. Inicia sesion de nuevo.", URL `/login?redirect=/perfil`; relogin returned to /perfil. Anonymous /tiendas: no redirect, no notice, TopBar "Explorar | Iniciar sesion". `?redirect=//evil.com` with a real merchant login -> `/panel-comercio` on localhost. Flag-ON build (throwaway `VITE_ENABLE_DEMO_SWITCHER=true vite build --outDir scratchpad/dist-on`, preview :4311, mocked API): menu shows "Cambiar de Cuenta" with the 6 accounts; scratch build deleted. Screenshots Read: pr10-admin-home, pr10-merchant-home, pr10-courier-home, pr10-accountant-home, pr10-expiry-b-logout, pr10-anon-tiendas, pr10-flag-on. Servers stopped by PID, ports free. No panel degraded.

### Gates
backend pytest 353 passed; `pnpm test` 528 passed (40 files; router/App/App.sync/LandingView/PwaStatus/StoresSection unchanged and green); vue-tsc clean; `pnpm build` ok; `pnpm test:e2e` 29 passed; tsbuildinfo restored.

### Not verified
- Docker: no `docker compose up/build`, so the Dockerfile ARG/ENV and the override were validated only by `docker compose config` and by the equivalent `VITE_ENABLE_DEMO_SWITCHER=true vite build`; the real image build and the project Postgres volume are V.1-V.3 (done separately by the user).
- Flag-ON switcher account clicks in a real browser (menu rendering only; the switch itself by component spec).
- Real expiry by a naturally timed-out access token (forced with garbage tokens); no multi-tab session sharing, no mobile viewport.
- Customer checkout redirect e2e (anonymous checkout -> login -> back to store with cart) not re-run in a browser in this PR (store/guard/Login specs cover pieces; StoreDetailView already pushed `redirect`).

### Remaining: `.env.development` (user), V.1/V.2/V.3
