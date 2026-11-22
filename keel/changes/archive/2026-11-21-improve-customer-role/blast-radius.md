# Blast Radius: improve-customer-role

Corrections applied: base branch `develop` exists; PR1 uses `python3.12 -m venv backend/.venv` (not default 3.14).

## 1. Endpoint auth x frontend caller (all in `useGoEatsStore.js` sync L152-161 unless noted)
Today `sincronizarConBackend` is ONE `Promise.all` of 8 GETs inside a silent `catch` (L149-299): any single 401/403 rejects all, so zones/merchants/products stay on mocks for every role.

| Endpoint (locked) | Callers / role | Class | Handling |
|---|---|---|---|
| GET /orders/ (L157) | all roles, also anonymous | BREAKS | allSettled + role gating (PR4); merchant/courier need `mine`/`me` |
| GET /payments/ (L158), /reports/audit-logs (L160) | needed by accountant+admin only; today fired by all | BREAKS (whole sync) | gate to accountant/admin |
| GET /users/arco (L159) | admin only (AdminView:29) | BREAKS (whole sync) | gate to admin |
| PATCH orders/status (L421,434; MerchantView:36-48, CourierView:41-52) | merchant, courier | AFFECTED | role-target matrix; rejected locally `cancelado` but sent `rechazado` (L431-434) |
| PATCH orders/courier (L443; MerchantView:43) | merchant | AFFECTED | own-order scope |
| POST orders/ (L363-390) | customer (StoreDetailView:42) | BREAKS | sends `tarjeta`, names, fee: Literal rejects `tarjeta` (PR6 same-PR wire `yappy`) |
| POST rating (L645; OrdersView:39) | customer | AFFECTED | ownership |
| receipt.pdf (L512; AccountingView:160) | accountant | AFFECTED | customer own only |
| POST users/me/arco (L624; ProfileView:28) | customer | AFFECTED | Literal 4 types match ProfileView:12-14 |
| auth login/register (L102-132; LoginView:50; TopBar:72) | all | BREAKS | body `role`/`accepts_privacy_policy` default True (L112,122); picker LoginView:19-26 |
| auth refresh (api.ts:90-107) | interceptor | AFFECTED | failure path clears tokens only; no store reset (see 4) |

Writes are `.catch(()=>{})`: a 401/403 silently leaves optimistic local state (no revert) until PR8.

## 2. Status strings
| Where | Evidence | Class |
|---|---|---|
| Backend transitions | `orders/service.py:16-26` accepts both; schema `schemas.py:40` | INTERNAL |
| Seed | `seed.py:333-338,369,383,458` | INTERNAL |
| Reports | `reports/repository.py:18` `!= "cancelado"` counts `rechazado` | BREAKS (KPI revenue wrong once seed adds `rechazado`); not in design File Changes |
| Frontend spaced keys | `mockData.js:13-42,240,263,285`; MerchantView:35,136,139,155; CourierView:159-165; OrdersView:114,135; store L65 | BREAKS after DB rewrite |
| Terminal lists missing `rechazado` | MerchantView:22-23; CourierView:26; store L65; OrdersView:88 (timeline only `!== 'cancelado'`) | BREAKS |
| `ESTADO_LABELS` lacks `rechazado` (badge exists) | mockData.js:24-31,42 | AFFECTED |
| Tests/e2e | none assert statuses; `HeroVisual.vue:6`, `content.ts:59,172` landing copy | stays valid |

## 3. Seed / init / volume
| Consumer | Evidence | Class |
|---|---|---|
| `reseed.py` calls `init()` after `drop_all` | reseed.py:8-10 | INTERNAL (inherits migrations step) |
| `main.lifespan` + `init_db` duplicate create_all+seed | main.py:19-24, init_db.py:15-18 | INTERNAL (wire both) |
| Dockerfile: init_db then `gunicorn -w 4` | backend/Dockerfile:15 | AFFECTED (lock ok) |
| Volume `postgres_data` (compose:11,60) | seed skips existing rows (seed.py:70, 348) | AFFECTED: no `rechazado`/links from seed; migration backfill only |
| Demo users: CUENTAS_DEMO store:21-28, TopBar:154, LoginView default carlos | emails in seed.py:42-66; merchant `c1`, courier r1/r2 hardcoded fallbacks MerchantView:20-21, CourierView:7-16 | AFFECTED (links by email) |
| Seed customers: Carlos owns first 8 orders (seed.py:347-352) | scoped list demo works | ok |

## 4. Frontend session/guards
| File | Status |
|---|---|
| `router.spec.ts`, `LandingView.spec.ts` (import `routes`), CtaBand/LandingNav specs | valid (guards installed outside `routes`) |
| `App.spec.ts` (store mock without `autenticado`) | valid; sync must not read tokenStorage |
| `App.sync.spec.ts` (api mock w/o `tokenStorage`, expects `get` called) | valid only if anonymous still calls public GETs; mock `get` rejects ALL (fine with allSettled) |
| `main.ts` (no await, no guards), `App.vue:15` sync onMounted | EDIT (PR10; restore before sync) |
| `api.ts` expiry hook, TopBar `salir`/switcher, LoginView picker | EDIT |
| e2e `landing*.spec.ts`, `smoke.spec.ts` (anonymous `/`, mock merchants/zones only) | valid; unmocked `/orders` etc. must not fire when anonymous |
| PwaStatus/StoresSection specs | unaffected |

## 5. Docker/build
| Item | Finding | Class |
|---|---|---|
| Root Dockerfile:12-13 | no ARG/ENV before `pnpm build`; add `ARG VITE_ENABLE_DEMO_SWITCHER=false` | EDIT |
| `docker-compose.override.yml` | auto-merged by `docker compose up/build web` (README:8 uses it); NOT loaded with `-f docker-compose.yml` (CI/prod stays false) | AFFECTED (document) |
| `.dockerignore` | has `.env*` (`.env.development` excluded from image: good); excludes `backend` from web context | ok |
| `backend/` has NO `.dockerignore`; Dockerfile:11 `COPY . .` | would copy `.venv`, tests, requirements-dev.txt, caches into prod image (Dockerfile:8-9 installs only requirements.txt) | BREAKS (image bloat/leak): add `backend/.dockerignore` |
| `.gitignore` has `.venv/`, `*.db`, `__pycache__`; no `.pytest_cache` | add | EDIT |
| `src/vite-env.d.ts:4-8` | add `VITE_ENABLE_DEMO_SWITCHER` | EDIT |

## 6. Other shapes
`tarjeta`: seed.py:340,462, store L381, schemas (orders:32, payments:9), providers.py:36-58 (legacy rows readable). Codes: orders/repository.py:41 (`len+1001`), payments/repository.py:37, seed PED-1040..1099. Consent default: users/schemas.py:12, store L112,122,36,97. ARCO values: seed.py:498-507, ProfileView:12-14, mockData:359-361 (match Literal; `Cancelación`/`Oposición` also valid).

## Must-handle list (sdd-tasks MUST convert each to a work item)
1. Reports `sum_revenue` exclude `rechazado` (with PR2 seed).
2. Frontend terminal sets (MerchantView:22-23, CourierView:26, store L65, OrdersView:88) include `rechazado`; add label.
3. Canonical keys in mockData (+ initial mock orders), MerchantView, CourierView, OrdersView, store.
4. `backend/.dockerignore`, `.pytest_cache` in `.gitignore`, `vite-env.d.ts`, Dockerfile ARG/ENV; document override vs `-f`.
5. allSettled sync: admin-only `/users/arco`, accountant/admin `payments`, `audit-logs`.
6. Remove hardcoded `c1`/`r2` fallbacks and name matching.
7. Wire `yappy` + drop client price/fee fields in the same PR as the backend Literal.
8. Verify seeded users have consent rows before PR9 gate (seed.py:83 does).

## PR ordering flags
| Flag | Problem | Fix |
|---|---|---|
| PR2 -> PR5 | Migration rewrites `en preparación` etc. to canonical on the existing volume while merchant/courier/customer views still compare spaced strings until PR5: those panels lose action buttons/timeline | Move status rewrite + canonical seed to PR5, or make views tolerant in PR2 |
| PR2 | Seeded `rechazado` order shown as active; revenue counts it | Items 1-2 in PR2, or seed `rechazado` in PR5 |
| PR4 -> PR10 | Store `autenticado` is false after reload (no restore until PR10) while orders are now locked: logged-in reload gives empty/mock panels | Move `restaurarSesion` to PR4 |
| PR3 | Picker/role body remain until PR10 but ignored: picking role navigates by server role (ok) | none |

## Published surfaces & compatibility
Public API consumed only by this PWA (CORS `*`, main.py:31); no external clients found. Old PWA caches (vite-plugin-pwa autoUpdate) may hit locked endpoints briefly.

## Verdict: BREAKS-UNHANDLED (PR2 status rewrite, PR4 session reload, `rechazado` handling, backend image ignore); design revision of PR slicing needed. Handling is cheap.
