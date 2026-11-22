# Tech
Last refreshed: 2026-11-20

## Stack (from manifests)
- Frontend (repo root, pnpm 11.2.2 in Docker, Node 22): Vue 3.4 (`<script setup>`), Vite 5.4, TypeScript 5.5 + vue-tsc 2, Pinia (^4.1.0 in package.json), vue-router 4, Tailwind 3.4, axios, Leaflet, `@lucide/vue`, vite-plugin-pwa + workbox-window. Mixed JS/TS (store, mockData, utils/geo are `.js`).
- Backend (`backend/`, Python 3.12 per spec, deps unpinned `>=` in requirements.txt): FastAPI, uvicorn + gunicorn, SQLAlchemy 2, Alembic, psycopg3, Pydantic v2 + pydantic-settings, PyJWT, bcrypt, boto3, httpx.
- Infra: docker-compose (postgres 16.15, MinIO, api :8000, web :5173 -> Caddy :80). Caddy serves the static PWA, proxies `/api/*` and `/health` to the API, SPA fallback, no-cache for service worker. Vite dev proxies `/api/v1` to localhost:8000.

## Settled decisions (with WHY)
- Modular monolith, 9 domains, layered Router > Service > Repository > Model: fits an 8-week, 4-person team and avoids collisions.
- Isolation rule: a domain must not import another domain's services; cross-domain reads go through the other domain's repository or controlled transactions/events.
- One PWA codebase for web + mobile instead of native apps.
- JWT access 30 min / refresh 7 days, HS256, bcrypt; RBAC in `core/rbac.py`.
- Payment adapter pattern (`payments/providers.py`) so real gateways can be added later.
- Prices, totals, delivery address text, and delivery coordinates (`orders.delivery_lat`, `orders.delivery_lng`) are frozen on order creation; audit tables insert-only.
- User profile stores optional default delivery address (`users.address`, `users.lat`, `users.lng`, nullable) updated via `PUT /users/me`; `_add_plain_column` in `backend/app/core/migrations.py` applies idempotent nullable column migrations under the startup advisory lock.
- Coverage check (`puntoEnCobertura` in `src/utils/geo.js`) compares Haversine distance against `COORDENADAS_ZONAS` radii (`radioM`) and surfaces a non-blocking warning in profile and checkout.
- Simulated payment gateway (`src/components/PaymentGatewayModal.vue` + `src/utils/card.ts`): validates Luhn, expiry, CVV, and 6-digit 3-D Secure OTP strictly in component memory; raw card/OTP fields are wiped before network calls and on close/unmount, never stored in Pinia/Storage or sent over the network. Decline simulation (`simulate_failure: true` on `POST /payments/`) is sent only when build-time `VITE_ENABLE_DEMO_SWITCHER === 'true'` (`DEMO_SWITCHER` in `src/config.ts`) and honored server-side only when `DEV_SIMULATE_FAILURE=true`.
- Customer catalog browsing (`src/utils/catalog.ts`, `StoresView.vue`, `StoreDetailView.vue`): accent-insensitive search, category chips (`category_type` / `category`), sorting, promo badge (`precioRegular > precio`), and closed-merchant ordering block (`is_open`).
- BackgroundTasks for async work (push); Redis/Celery only if load requires.
- Frontend API base: `src/services/api.ts` (axios, bearer token + refresh interceptors per spec).

## Testing and quality (Strict TDD: ON)
- Automated runners active and verified:
  - Frontend unit/component/store/build: `pnpm test` (Vitest 2.1 + `@vue/test-utils` + `jsdom`, 50 test files).
  - Frontend E2E: `pnpm test:e2e` (Playwright Chromium against production build, 33 tests).
  - Backend API/integration: `cd backend && .venv/bin/pytest -q` (pytest + FastAPI TestClient + SQLite in-memory, 416 tests).
  - Typecheck & build: `pnpm exec vue-tsc -b` and `pnpm build`.
- security_review: ON. Review auth, RBAC, ownership (`owner_user_id` / `user_id`), secrets, CORS, PII/ARCO and payments on every change.

## Resolved architecture items (formerly gaps)
1. Startup migrations (`backend/app/core/migrations.py`) run idempotently under a Postgres advisory lock in `main.lifespan` and `init_db.py` (adds `owner_user_id`, `user_id`, `address`, `lat`, `lng`, `delivery_lat`, `delivery_lng`, backfills `ENTITY_LINKS`, and normalizes legacy spaced order statuses to canonical `snake_case`).
2. Store writes use `store.escribir` (`src/stores/useGoEatsStore.js`, `src/services/errors.ts`) with snapshot rollback and typed Spanish error toasts; `sincronizarConBackend` uses role-gated `Promise.allSettled`.
3. Merchant schedule/catalog mutations (`merchants/service.py`, `catalog/service.py`) and courier availability mutations (`delivery/service.py`) enforce strict entity ownership (`owner_user_id` / `user_id`); admin user account status (`PATCH /users/{id}/status`) prevents self-suspension.
4. Remaining external-infra items outside local Docker scope: GitHub Actions CI workflow, Terraform DigitalOcean/Hostinger provisioning, and live FCM credentials (`shared/push.py` runs via `BackgroundTasks` log adapter).
