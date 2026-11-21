## Exploration: improve-customer-role (customer audit)

Note: no shell tool was available, so no Playwright screenshots were taken and no pytest/vitest runs. Findings are static code reading (file:line).

### Current State
Frontend customer flow works end to end on the Pinia store, which seeds from mockData.js and overwrites state from the API in `sincronizarConBackend` (useGoEatsStore.js:141). Writes are optimistic local mutations followed by fire-and-forget `.catch(() => {})` (e.g. :372-391, :420, :624, :645). Backend exposes the endpoints but with weak authorization.

### RF coverage (customer)
| RF | Status | Frontend | Backend | Real API? | Tests |
|---|---|---|---|---|---|
| 03 tracking + courier data | mock-only/partial | OrdersView.vue:114-147, CoverageMap.vue:384 (setInterval fakes courier progress) | PATCH status; push.py:7 is a log-only stub | Order status only on page load; no polling/WS; courier phone fallback '6812-3344' (:141), rating fallback 4.9 (:145) | none |
| 04 merchants by zone polygon | partial | StoresView.vue, utils/geo.js:3 (circles `radioM`, not polygons) | merchants router `?zone=` slug; no polygon in zones model | API for list; coverage geometry hardcoded in frontend | CoverageMap.spec only |
| 05 catalog | done | StoreDetailView.vue:103 | catalog router public GET | Yes (sync) | none |
| 06 product detail | partial | no detail view; description+price+"Agotado" inline | GET /catalog/products/{id} exists, unused | n/a | none |
| 07 register + Ley 81 | partial | LoginView.vue:46,129-134 (checkbox required on login too; policy button dead :132) | auth/service.py:23, repository.py:35 writes data_consents | Yes; fallback to local "login" when API down (store:132-137) | none |
| 08 login + RBAC | partial/insecure | LoginView role picker; TopBar demo switcher with hardcoded `demo1234` (store:81-85) | auth/service.py:60 | Yes, but see gaps | none |
| 09 profile + ARCO | partial | ProfileView.vue:19-32,73-74 | users router /me, /me/arco | Name/phone only; email edit ignored; consent toggle local only; ARCO list from public GET | none |
| 10 payment | partial/mock-only | StoreDetailView.vue:57-60, store simularPago:396 | payments router + providers.py exist | Frontend never calls POST /payments; order sent as 'tarjeta' (store:381); outcome local only | none |
| 14 cart + confirm | partial | StoreDetailView.vue, store:312-394 | POST /orders (customer/admin) | Order created optimistically; failure swallowed, user sees success | none |
| 15 shipping estimate | partial | zone tariff only (StoreDetailView.vue:23, store:336) | geo.py:4 ignores distance_km | Client sends delivery_fee, server trusts it (repository.py:40) | none |
| 20 rate merchant+courier | partial | OrdersView.vue:165-221 | POST /orders/{code}/rating (status guard) | Yes, silent failure; courier stars default = merchant stars (store:643) | none |

### Prioritized gaps
Security/correctness
| # | Sev | Gap | Evidence |
|---|---|---|---|
| 1 | Critical | Any user logs in as ANY role (role override from request body) | auth/service.py:60; also register accepts `role: admin` (users/schemas.py:11) |
| 2 | Critical | GET /orders/ is anonymous and never filters by customer; any visitor sees all orders/PII | orders/router.py:17-25 (customer_id never passed) |
| 3 | High | GET /orders/{code} and POST rating have no ownership check; any authenticated role can read/rate any order | router.py:29,75; service.py:126 |
| 4 | High | Price tampering: server trusts client unit_price, delivery_fee, merchant_name, customer_name | orders/schemas.py:8-34, repository.py:39-40 |
| 5 | High | /users/arco, /payments/, /reports/audit-logs anonymously readable (PII/finance) | users/router.py:43, payments/router.py:12, reports/router.py:27 |
| 6 | High | No route guards: anyone opens any panel; role/authenticated state lost on refresh (state not persisted, only tokens) | router.ts:5-17, store:34-36 |
| 7 | High | Ley 81: `accepts_privacy_policy` defaults True server-side; consent forced true on login; profile toggle not persisted; no consent read/revoke endpoint | users/schemas.py:12, store:122, ProfileView.vue:74 |
| 8 | Med | Silent write failures show success (orders, rating, ARCO, profile); offline fake login | store:129-138, :391 |
| 9 | Med | State-string split: UI uses 'en preparación', API allows `en_preparacion`; 'rechazado' and underscored states render wrong/0% in timeline | service.py:15-27, mockData.js:13, OrdersView.vue:114 |
| 10 | Med | pedidosComoCliente matches by name (collision) | store:63 |
| 11 | Med | Payment status never persisted for electronic orders; `simularPago` only local | store:396-412 |

Missing RF / UX
| # | Gap |
|---|---|
| 12 | RF-03 no live data (no polling/WS), simulated map movement; courier shown only in 'en camino' |
| 13 | RF-15 distance not used in fee; no estimate before choosing zone via address |
| 14 | RF-06 no product detail view/route |
| 15 | RF-04 polygons are circles in frontend; no `polygon` on zones; no address-to-zone validation |
| 16 | A11y: icon-only buttons without aria-label (cart close, stars, +/-), modals lack role="dialog"/focus trap/Esc, star rating not keyboard/label accessible, toast not aria-live, dead policy button (LoginView.vue:132) |
| 17 | UX: rioplatense copy in StoresView.vue:92 ("Hacé clic") and emoji; error strings from API in English shown to user |

### Test feasibility
- Frontend: vitest 2.1 + @vue/test-utils + jsdom + Playwright already present (package.json:10,24,27,35). Pattern: `vi.mock('./services/api')` + `createPinia` (App.sync.spec.ts:7-37). Store tests are cheap (mock api, call actions, assert state and calls). Component tests: mount views with memory router + pinia; stub CoverageMap.
- Backend: no pytest, no tests dir. Minimum: add `pytest` to a requirements-dev, `backend/tests/conftest.py` with FastAPI TestClient (httpx already in requirements), SQLite in-memory engine overriding `get_db` (check models are SQLite-compatible; alembic.ini already points at sqlite), a user/token factory using `core.security`. Lightweight: no docker needed.

### Candidate scopes (one change)
| Scope | Work units | Size |
|---|---|---|
| Small: "Customer security + correctness" | U1 pytest bootstrap + RBAC/ownership tests (orders list/get/rate, login role override, register role) then fixes; U2 route guards + persisted session (router.spec, store tests); U3 stop silent failures in store (await + error toast) | ~3 units, M |
| Medium (recommended): Small + RF gaps | + U4 server-side order pricing and fee (RF-14/15, use distance via geo.py); U5 payments wired (POST /payments, real status; RF-10); U6 consent/ARCO real (RF-07/09, GET own ARCO, consent persisted); U7 status-string normalization | ~7 units, L |
| Large: Medium + tracking/product detail | + RF-03 polling endpoint/tracking view with real courier data, RF-06 detail route, RF-04 zone polygons (migration), a11y pass, Playwright customer e2e | ~11 units, XL |

Test strategy per unit: pytest (auth, orders, users, payments authz and pricing); vitest store tests (actions + api mocks); vitest component (OrdersView timeline/rating, ProfileView ARCO, LoginView consent, StoreDetailView checkout); router.spec for guards; Playwright e2e (api mocked via route interception) for browse -> order -> rate.

### Recommendation
Medium scope, delivered strict-TDD in this order: pytest bootstrap, backend authz (gaps 1-5), route guards and session, store write handling, pricing/fee, payments, consent/ARCO, state-string normalization. Defer RF-03 live tracking, RF-06 and polygons to a follow-up (or large variant) since they depend on courier/merchant status updates.

### Risks and cross-role dependencies
- Fixing gaps 1-5 changes shared endpoints: merchant/courier/admin/accountant panels rely on anonymous GET /orders, /payments, /users/arco, /reports/audit-logs (store sync :141 fires all in one Promise.all). Need role-scoped listing (merchant by own merchant, courier by own code, admin/accountant all) and a sync that tolerates 403 per call.
- Demo switcher uses a shared password and role override; removing the override breaks the demo accounts unless seed users get proper roles (seed.py).
- RF-03 depends on merchant/courier status updates and courier GPS (no endpoint exists).
- Order-state normalization touches MerchantView.vue:136 and CourierView.vue, and the seed.
- SQLite-vs-Postgres drift in backend tests; no Alembic versions, so schema changes (polygon, consents) need init_db handling.

### Ready for Proposal
Yes. Open decisions: scope (small/medium/large), canonical state strings (underscore vs space), whether to keep the role-picker/demo switcher as a dev-only feature, and whether login role override is intentionally a demo feature.
