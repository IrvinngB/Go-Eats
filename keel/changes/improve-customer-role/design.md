# Design: Improve Customer Role

Word count: ~2,300 (OVER the 1,200 target; the change spans 7 capabilities, tables used to compress). Clarifications win over specs where they differ.

## Technical Approach
Backend-first strict TDD in 10 stacked PRs. Order: harness, additive schema and migration, auth hardening, scoped reads shipped with sync tolerance, state machine, pricing, payments, store writes, consent, guards. Rule: no PR makes an old client or another role's panel fail.

## Verified facts
| # | Fact | Evidence |
|---|------|----------|
| F1 | Only Python on this machine is Xcode CLT 3.9 (`/Library/Developer/CommandLineTools/.../Versions/3.9`); no 3.12, no uv; `brew` exists. App needs >=3.11 (`from enum import StrEnum`, `core/rbac.py:1`). | Glob (no shell this session, `python3 --version`/pip NOT executed) |
| F2 | `database.py` builds the engine at import from `settings.database_url`; `main.lifespan` runs create_all+seed only inside a `with TestClient` | `core/database.py:6-8`, `main.py:19-24` |
| F3 | Dockerfile CMD runs `python -m app.init_db` (single process) BEFORE `gunicorn -w 4`; each worker then runs lifespan again | `backend/Dockerfile:15` |
| F4 | `App.sync.spec.ts` mocks `./services/api` WITHOUT `tokenStorage`: sync must decide "anonymous" from store state, never from `tokenStorage` | `App.sync.spec.ts:8-11` |
| F5 | `notificar` never auto-dismisses (`id === Date.now()` compares two different ms values) | `useGoEatsStore.js:73` |
| F6 | Store offline fallback authenticates ANY role locally on network error: defeats guards | `useGoEatsStore.js:132-137` |
| F7 | `.dockerignore` has `.env*`; `.gitignore` ignores only `*.local`; Playwright runs a production build | `.dockerignore`, `playwright.config.ts:11` |

## Architecture Decisions
| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| ADR1 Test harness | `backend/requirements-dev.txt` (`-r requirements.txt`, `pytest>=8`), `backend/pytest.ini` (`pythonpath=.`), `tests/conftest.py`: set `DATABASE_URL=sqlite://` BEFORE importing `app`; test engine `StaticPool`+`check_same_thread=False`; `app.dependency_overrides[get_db]`; `TestClient(app)` WITHOUT context manager (no lifespan); `import app.init_db` to register all models; factories `make_user/make_merchant/make_courier/make_zone/make_product/auth_headers` using `core.security` (precomputed bcrypt hash constant for speed); flags via `monkeypatch.setattr(settings, ...)` | Real lifespan; file DB | F2: hermetic, never touches `goeats.db` |
| ADR2 Run | One-time: `brew install python@3.12 && python3.12 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements-dev.txt`; then `cd backend && .venv/bin/pytest`. CI-ready: same command in `python:3.12-slim` (no CI exists; not added) | System 3.9 | F1 |
| ADR3 Migration | `backend/app/core/migrations.py::run_startup_migrations(engine)`; order in `lifespan` and `init_db.init()`: `create_all` -> `run_startup_migrations` -> `seed`. Seed sets links itself on fresh DBs from the shared `ENTITY_LINKS` constant | Alembic baseline; reseed | Existing PG volume has >=40 orders so seed is skipped; Alembic unverified |
| ADR4 Entity link | `merchants.owner_user_id`, `couriers.user_id`: nullable, unique, indexed, FK users.id (index names `ix_merchants_owner_user_id`, `ix_couriers_user_id` identical in model and migration). Never exposed in `MerchantRead`/`CourierRead`; two role-guarded endpoints `GET /merchants/mine` (declared BEFORE `/{code}`) and `GET /delivery/couriers/me`, 404 `no_linked_entity` when unlinked | Extend `UserRead` | Keeps ids scoped |
| ADR5 Boundary | Reject, never normalize: `OrderStatusUpdate.status: Literal[8 canonical]` (spaced -> 422); `payment_method`/`method: Literal["contr_entrega","yappy"]`; ARCO `request_type: Literal[4]`. Read paths never validate (legacy `tarjeta` rows stay readable) | Silent normalization | Spec "Spaced variants rejected" |
| ADR6 Error policy | 401 no/invalid token; 403 role not allowed or `consent_required`; 404 object outside caller scope (does not reveal existence); 400 business rule (transition, merchant closed, product unavailable, missing reason); 409 duplicate payment; 422 schema | 403 for scope | Avoids order-code enumeration |
| ADR7 Codes | `max(cast(substr(code,5) as int))+1` filtered by prefix (`PED-`, `TX-`), floor 1001/9001, retry up to 3x on `IntegrityError` (rollback, recompute); receipt number derives from same seq | uuid suffix | Readable codes; fixes PED-1061 collision with seeded PED-1040..1099 (`repository.py:41`) |
| ADR8 Route guards | `src/guards.ts` (TS): `ROLE_HOME`, `installGuards(router, getSession)`, `safeRedirect(router, raw, rol)`. Access table keyed by route NAME inside guards.ts, not in `routes` | Guards in `routes` meta | Keeps `router.spec`/`LandingView.spec` valid |
| ADR9 Session restore | `store.restaurarSesion()` called in `main.ts` BEFORE `app.use(router)`: if token exists, `GET /users/me` (role from DB, interceptor refreshes). 401 -> anonymous. Network error -> anonymous without clearing tokens | JWT decode | Client-decoded role is untrusted and needs refresh anyway |
| ADR10 Session expiry | `api.ts` exports `setSessionExpiredHandler(fn)`; fires only when the failed request carried an Authorization header and refresh failed; registered in `main.ts` (not store/App: F4) | Callback in store | Anonymous public sync never redirects |
| ADR11 Demo flag | `src/config.ts`: `DEMO_SWITCHER = import.meta.env.VITE_ENABLE_DEMO_SWITCHER === 'true'`; gates TopBar switcher, `cambiarACuentaDemo` (hardcoded `demo1234`), LoginView credential prefill. LoginView role picker REMOVED. Root Dockerfile: `ARG VITE_ENABLE_DEMO_SWITCHER=false` + `ENV` before `pnpm build`; committed `docker-compose.override.yml` sets `web.build.args` true; `.env.development` for `pnpm dev`. Backend `DEV_ROLE_OVERRIDE`/`DEV_SIMULATE_FAILURE` default off, true only for `1/true/yes` (case-insensitive) | Backend flag for demo | Switcher uses real logins; backend flag is emergency-only |

## Migration module (`run_startup_migrations`)
| Step | Behavior |
|------|----------|
| Lock | One `engine.begin()` transaction; on PG `SELECT pg_advisory_xact_lock(724001)` (DDL is transactional in PG so workers serialize); SQLite: no lock. Wrapped in try/except `ProgrammingError/OperationalError` "duplicate column": log WARNING, re-inspect, continue |
| Columns | `inspect(conn)`; if table exists and column missing: `ALTER TABLE merchants ADD COLUMN owner_user_id INTEGER REFERENCES users(id)` (portable plain syntax) |
| Indexes | `CREATE UNIQUE INDEX IF NOT EXISTS ...` (PG and SQLite; NULLs may repeat) |
| Backfill | Email map from clarifications (hector->c1, patricia->c2, arturo->c3, monica->c4; javier->r1, maria->r2, luis->r3, pedro->r4), `UPDATE ... WHERE owner IS NULL AND user exists AND user not already linked` |
| Status rewrite | 3 `UPDATE ... WHERE status IN (...)` on `orders.status`, `order_status_history.previous_status`, `.new_status` (3-entry map) |
| Existing PG volume | Dockerfile's `init_db` runs it once first (F3); the 4 workers find a no-op. Adds 2 columns, 8 links, rewrites statuses; `tarjeta` rows untouched; no `rechazado` row inserted |
| Fresh SQLite | create_all already has columns; migration is a no-op; seed links entities |

## Authz design
Role-scoped listing (`OrderService.list_for(user)`; repositories only, like `CourierRepository` precedent):
| Role | Scope |
|------|-------|
| customer | `customer_id == user_id` |
| merchant | `merchant_code == MerchantRepository.get_by_owner(user_id).code`; unlinked -> `[]` |
| courier | `courier_code == CourierRepository.get_by_user(user_id).code`; unlinked -> `[]` |
| admin, accountant | all; `merchant_code`/`courier_code` query params honored ONLY here |

Endpoint x role (A anon, C customer, M merchant, K courier, T accountant, D admin; 401 = A; "own" = scoped, out of scope -> 404; 403 otherwise):
| Endpoint | A | C | M | K | T | D |
|----------|---|---|---|---|---|---|
| POST auth/register, login, refresh | ok | ok | ok | ok | ok | ok |
| GET orders/ | 401 | own | own | own | all | all |
| GET orders/{code} | 401 | own | own | own | ok | ok |
| POST orders/ (+consent) | 401 | ok | 403 | 403 | 403 | 403 |
| PATCH orders/{code}/status | 401 | 403 | own* | own* | 403 | ok |
| PATCH orders/{code}/courier | 401 | 403 | own | 403 | 403 | ok |
| POST orders/{code}/rating | 401 | own | 403 | 403 | 403 | 403 |
| GET payments/ | 401 | 403 | 403 | 403 | ok | ok |
| POST payments/ (+consent) | 401 | own order | 403 | 403 | 403 | 403 |
| PATCH payments/{code}/status | 401 | 403 | 403 | 403 | ok | ok |
| GET payments/{code}/receipt.pdf | 401 | own | 403 | 403 | ok | ok |
| GET reports/kpis, financial, audit-logs | 401 | 403 | 403 | 403 | ok | ok |
| GET/PUT users/me, me/consent; GET/POST me/arco | 401 | ok | ok | ok | ok | ok |
| GET users/arco, POST arco/{id}/resolve, GET users/ | 401 | 403 | 403 | 403 | 403 | ok (resolve, list: admin) |
| GET merchants/mine, delivery/couriers/me | 401 | 403 | ok | K only | 403 | 403 |
| zones, merchants, catalog, couriers GET | ok | ok | ok | ok | ok | ok |

*Status target by role (any role still bound by the transition table; wrong target -> 403): merchant `confirmado, en_preparacion, listo_para_recoger, rechazado, cancelado`; courier `en_camino, entregado, cancelado`; admin any.
Unchanged and listed as out of scope: merchant schedule, catalog and courier availability ownership.

Login/register/refresh: `UserCreate.role` removed (extra `role` ignored, always `customer`); `accepts_privacy_policy` default False. Login honors body `role` only if `settings.dev_role_override` (else ignored with WARNING log); refresh always uses `user.role` from DB.

Consent: `users/dependencies.py::require_active_consent` (customer role first, then latest `DataConsent` by `id desc`; none or false -> 403 `detail="consent_required"`), applied to `POST /orders/` and `POST /payments/`.
```python
class ConsentRead(BaseModel): accepted: bool; policy_version: str | None; accepted_at: datetime | None
class ConsentUpdate(BaseModel): accepted: bool        # PUT appends a row (history kept), writes audit event
ArcoType = Literal["Acceso", "Rectificación", "Cancelación", "Oposición"]
GET /users/me/arco -> list[ArcoRequestRead]   # own, id desc
```

## Pricing, payments, state machine
| Topic | Design |
|-------|--------|
| `OrderCreate` | `merchant_code, zone_slug, delivery_address, notes, payment_method: Literal, items:[{product_code, quantity (1..50), notes}]`; unknown/extra client fields (price, fee, names) ignored |
| Recompute | merchant exists (404), `affiliation_status=="activo"` and `is_open` else 400 `merchant_unavailable` (no schedule check); zone exists and active; each product belongs to merchant and `is_available` else 400; `unit_price = promo_price if promo_price > 0 else price`; `delivery_fee = calculate_delivery_fee(zone.delivery_fee, zone.distance_km)`; names/phone from catalog and `User` |
| `PaymentCreate` | `{order_code, method: Literal, simulate_failure=False}`; amounts from the order; order must be caller's (404), status `pendiente`, method equal to the order's (400), no existing non-`fallido` payment (409). `simulate_failure` honored only if `settings.dev_simulate_failure`. `get_payment_provider` raises on unknown method. `fallido` electronic -> system cancels order with reason "Pago electrónico rechazado" (actor `sistema:pago`) |
| Transitions | pendiente->confirmado; confirmado->en_preparacion; en_preparacion->listo_para_recoger; listo_para_recoger->en_camino; en_camino->entregado; any non-terminal->cancelado or rechazado (mandatory non-blank reason, 400); terminal: entregado, cancelado, rechazado. Canonical keys only |
| Seed | canonical cycle + one `rechazado` order with reason; line 369 set canonical; methods cycle `["contr_entrega","yappy"]` |

## Frontend design
| Area | Design |
|------|--------|
| Guards | Public by name: `landing, login, stores, store-detail`. `orders, profile` customer; `merchant, courier, accountant, admin` own role. Anonymous on protected -> `{name:'login', query:{redirect: fullPath}}`; wrong role -> `ROLE_HOME[rol]`; authenticated at `login` -> home; authenticated non-customer at `stores/store-detail` -> home. Catch-all stays `/tiendas` then guard applies |
| Install | `main.ts`: create pinia, `await store.restaurarSesion()`, `installGuards(router, () => ({autenticado, rol}))`, `setSessionExpiredHandler`, then `app.use(router)`. Tests: `installGuards(createRouter({history: createMemoryHistory(), routes}), () => session)` |
| `?redirect` | Allow only strings starting `/` (not `//`, no `\`, no scheme) whose `router.resolve` name is allowed for the session role; else null -> role home |
| Sync | `Promise.allSettled`; public always (zones, merchants, couriers, products); private by `this.autenticado`+`rol`: customer/merchant/courier `orders`; accountant `orders, payments, audit-logs`; admin `orders, payments, users/arco, audit-logs`; merchant `/merchants/mine`, courier `/couriers/me`. Fulfilled private lists assigned even when empty; per-call 401/403/404 swallowed, never a toast. `cerrarSesion` clears private state |
| Writes | `src/services/errors.ts::toWriteError(err)` -> `{status, code, mensaje}` (Spanish; `consent_required`, 401, 403, 404, 409, 400/422, network). Store helper snapshot -> optimistic -> `await api` -> on failure restore + `notificar(mensaje)` + `{ok:false}`; success toasts move from views into store after `ok`. Cart cleared only on success. Fix F5 |
| `crearPedido` | async: `POST /orders/` (wire `electronico`->`yappy`), map response, then `POST /payments/` if electronic. Anonymous -> `router.push({name:'login', query:{redirect:'/tiendas/<id>'}})`, cart kept. Modal: single "Pagar (simulado)" button (reject button removed); label "Pago electrónico (simulado)" |
| Mapping | `precio = promo_price>0 ? promo_price : price` (`precioOriginal` struck through); `metodoPago` read: `contr_entrega` else `electronico`; `pedidosComoCliente = pedidos` (server-scoped) |
| Login | Remove picker and offline fallback (F6); policy `<button>` removed; checkbox required only on register; navigate `safeRedirect(...) ?? ROLE_HOME[store.rol]` using SERVER role |
| Profile | consent checkbox bound to `store.consentimiento` (`GET/PUT /users/me/consent`, rollback on failure, revoke note); ARCO history from `GET /users/me/arco`; email read-only |
| Panels | Merchant/Courier use `store.comercioPropio`/`repartidorPropio` (from `mine`/`me`), drop name matching and `c1`/`r2` fallbacks, show "Cuenta sin comercio/repartidor asignado" empty state |
| States | `mockData.js` `ESTADOS_PEDIDO`, label/color maps, Merchant/Courier/Orders views and store use canonical keys; `rechazado` rendered terminal with reason |
| TopBar | Anonymous: "Iniciar sesión" button, no avatar; switcher section only if `DEMO_SWITCHER` |

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `backend/requirements-dev.txt`, `backend/pytest.ini`, `backend/tests/conftest.py` | Create | ADR1 |
| `backend/tests/test_{smoke,migrations,auth,orders_scope,status,pricing,payments,consent}.py` | Create | per unit |
| `backend/app/core/migrations.py` | Create | ADR3 |
| `backend/app/core/config.py` | Modify | two flags |
| `backend/app/main.py`, `init_db.py`, `seed.py` | Modify | wiring, links, canonical seed |
| `domains/merchants/{models,repository,router,schemas}.py`, `delivery/{models,repository,router}.py` | Modify | owner link, `mine`/`me` |
| `domains/auth/{service,schemas}.py`, `users/{schemas,router,service,repository}.py`, `users/dependencies.py` (new) | Modify/Create | auth, consent, ARCO |
| `domains/orders/{router,service,repository,schemas}.py`, `payments/{router,service,repository,schemas,providers}.py`, `reports/router.py` | Modify | scope, pricing, payments, locks |
| `src/guards.ts`, `src/config.ts`, `src/services/errors.ts` | Create | ADR8, ADR11 |
| `src/main.ts`, `services/api.ts`, `stores/useGoEatsStore.js`, `mockData.js`, `vite-env.d.ts` | Modify | session, writes, states |
| `src/views/{LoginView,customer/*,merchant/MerchantView,courier/CourierView}.vue`, `components/TopBar.vue` | Modify | per design |
| `Dockerfile`, `docker-compose.override.yml`, `.env.development` | Modify/Create | flag |
| `src/guards.spec.ts`, `src/stores/useGoEatsStore.spec.ts`, `src/components/TopBar.spec.ts`, `src/views/**/*.spec.ts`, `e2e/guards.spec.ts` | Create | tests |

## Work Units (stacked; base branch per Open Questions)
| PR | Scope | Est. lines (code+tests) |
|----|-------|-------------------------|
| 1 | Harness + smoke test | ~140 |
| 2 | Migration module, entity link columns, seed canonical + `rechazado`, migration idempotency test | ~350 |
| 3 | Auth hardening: dev flag, register forced customer, refresh from DB; LoginView navigates by server role | ~220 |
| 4 | Scoped reads + locks (orders list/get, payments GET, users/arco GET, reports) + `mine`/`me` + store allSettled/role-gated sync + panels use linked entity | ~450 |
| 5 | State machine, Literal status (422), role-target matrix, rating ownership, courier-assign scope; frontend canonical states + `rechazado` timeline | ~420 |
| 6 | Server pricing, merchant check, code generation, method Literal; frontend wire `yappy` + promo mapping | ~380 |
| 7 | `POST /payments`, receipt owner, simulate flag; async `crearPedido` + payment modal | ~420 |
| 8 | Store write helper, typed errors, rollback for all writes, F5/F6 fixes | ~380 |
| 9 | Consent/ARCO endpoints, gate on orders+payments, ProfileView wiring | ~350 |
| 10 | Guards, session restore, expiry hook, TopBar/Login flag, Dockerfile+compose override, `e2e/guards.spec.ts` | ~450 |

**Revision:** the slicing above was found BREAKS-UNHANDLED by blast-radius (PR2 status rewrite breaks views until PR5, `rechazado` counted as revenue, no session restore until PR10, backend image ignore). The authoritative slicing is in `tasks.md` ("Slicing revision"): status rewrite and canonical seed move to PR5, `restaurarSesion` to PR4, `yappy` wiring to PR6, `backend/.dockerignore` to PR1. Base branch is `develop`.

10 units is one over the 7-9 target; PR 3 (~220) can fold into PR 4 only by exceeding 450 lines, so it stays split.

## Testing Strategy (strict TDD: red test committed first in each PR)
| PR | Tests |
|----|-------|
| 1 | pytest: `/health`, login via factory user, no `goeats.db` created |
| 2 | Legacy DDL (users, merchants, couriers, orders, history with `en camino`) on StaticPool; run twice; assert columns, 8 links, statuses canonical, no error; fresh-schema no-op; fresh seed links and has `rechazado` |
| 3 | Login ignores `role` flag off, honors on; register `role:admin` -> customer; refresh role from DB |
| 4 | Per role list (customer own, merchant linked, unlinked `[]`, courier, admin/accountant all); anon 401; other-order GET 404; vitest: sync anonymous calls only public, a 403 does not drop zones, empty orders replace mocks, no toast (App.sync.spec stays green) |
| 5 | Parametrized transition table, spaced -> 422, blank reason 400, customer 403, merchant out of scope 404, rating non-owner 404 |
| 6 | Tampered price/fee ignored, promo applied, closed merchant 400, first order after seed `PED-1100`, collision retry via monkeypatched `next_code` |
| 7 | Payment amounts from order, duplicate 409, flag-off ignores `simulate_failure`, `tarjeta` 422, legacy `tarjeta` row readable; vitest `crearPedido` calls orders then payments |
| 8 | vitest: failed write restores snapshot and toasts mapped message; success path |
| 9 | Consent latest-by-id, revoke -> 403 `consent_required` on both POSTs, re-grant ok; ARCO own list and Literal 422; ProfileView component test |
| 10 | `guards.spec.ts`: anonymous to login with redirect, wrong role to home, `//evil.com` and `https:` rejected, login-page redirect; TopBar spec with `vi.stubEnv`; Playwright (production build, API routes mocked): anonymous `/panel-admin` lands on `/login?redirect=%2Fpanel-admin`, mocked customer login returns to allowed target. Existing `router.spec`, `LandingView.spec`, `App.spec`, e2e landing: unchanged and must stay green |

Edits to existing tests: none planned (F4 kept by design); full vitest run per PR confirms. `mockData` key changes (PR 5) may touch any spec importing spaced states; grep shows only landing copy, which is unaffected.

## Migration / Rollout
Additive: 2 nullable columns, 2 unique indexes, status string rewrite. Merge order = PR order; PRs 4, 5, 6 are paired backend+frontend to stay compatible. Optional demo rechazado on existing volumes: `docker compose exec api python -m app.reseed` (drops all data).

## Rollback & Reversibility
| Item | Plan |
|------|------|
| Migrations | Not auto-reversible, no down(). Columns are harmless to old code (ORM ignores). Manual: drop indexes then `ALTER TABLE ... DROP COLUMN` |
| Status rewrite | Old backend accepts both spellings (`VALID_TRANSITIONS`), but old frontend maps spaced keys: revert PR 5 backend and frontend together |
| Flags | `DEV_ROLE_OVERRIDE=1` restores login override (emergency only); `VITE_ENABLE_DEMO_SWITCHER` is build-time |
| Late-revert loss | None unrecoverable: consent rows append-only, orders keep new codes/`yappy`. Orders created after PR 6 keep server-recomputed totals |
| Mechanics | Maintainer: `git revert -m 1 <merge>` newest first; verify `pytest`, `pnpm test`, `/health`, demo login of all 5 roles |

## Observability
| Path | Signal |
|------|--------|
| Migration | INFO per step with counts (columns added, links, rows rewritten); WARNING on duplicate-column race |
| Auth | WARNING when body `role` ignored (user_id only); existing `AuthEvent` kept |
| Authz | WARNING on scoped 404 and wrong-target 403 with user_id, role, resource code (no PII) |
| Payments/codes | INFO gateway result (order_code, status, reference); WARNING on code-collision retry |
| Consent | audit event on grant/revoke (existing `record_audit_event`) |
| Frontend | Spanish toast per failed write; session-expiry redirect |
| Success metric | 0 anonymous 200s on locked endpoints; 5xx rate on `POST /orders` ~0 after seeded DB; retry-log count near 0 |

## Risks
| Risk | Mitigation |
|------|------------|
| Other panels break | PR 4 pairs scoped reads with allSettled sync; per-role tests; unlinked -> empty state |
| Demo accounts | Seed + backfill map by email; switcher uses real logins; override compose sets flag |
| PG volume | Idempotent migration, advisory lock, tested on legacy DDL (SQLite only: PG advisory path untested in CI, verify once on compose) |
| Gunicorn races | F3 pre-run plus lock plus catch |
| Default secrets | Untouched (out of scope) |
| `/users/me` on boot | Adds one request and up to 10s timeout only when a token exists |

## Open Questions
- [ ] Base branch: proposal says `develop`, repo history merges to `main`; no `develop` seen. Confirm before PR 1.
- [ ] Python 3.12 not installed here and nothing was executed (no shell): PR 1 must first verify `brew install python@3.12` and pytest install.
- [ ] Failed electronic payment auto-cancels the order (ADR in payments row): confirm against customer-payments spec (not re-read).
- [ ] Merchant schedule, catalog and courier availability ownership remain unscoped (follow-up).
