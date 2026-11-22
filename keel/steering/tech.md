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
- No test runner exists yet. The FIRST change must add vitest (frontend) and pytest (backend, with httpx TestClient) before any feature work; tests precede code.
- Commands today: typecheck `pnpm exec vue-tsc -b`; build `pnpm build`; dev `pnpm dev`; install `pnpm install --frozen-lockfile`; backend install `pip install -r backend/requirements.txt`; stack `docker compose up --build`.
- Lint/format: none configured.
- security_review: ON. Review auth, RBAC, secrets, CORS, PII/ARCO and payments on every change.

## Known gaps vs spec (do not treat as settled)
1. No CI (GitHub Actions) and no Terraform; spec calls for both plus DigitalOcean/Hostinger deploy.
2. Alembic has `env.py` but no `versions/`; `alembic.ini` points to `sqlite:///./goeats.db`. Schema is created by `Base.metadata.create_all` plus seed in the FastAPI lifespan. `core/config.py` also defaults `DATABASE_URL` to sqlite when unset.
3. Store mixes mocks (`mockData.js`) and API calls; several writes use fire-and-forget `.catch(() => {})`.
4. Duplicated order-state strings in `backend/app/domains/orders/service.py` ("en preparación"/"en_preparacion", "listo para recoger"/"listo_para_recoger"); `seed.py` also uses the spaced form. Canonical (spec + schema): snake_case.
5. Cross-domain imports to audit against the isolation rule: orders -> delivery (`CourierRepository`, repository-level), reports -> merchants/orders/payments (repository), auth -> users (`UserRepository`, `users.schemas`). Observed imports are repository/schema level, not service level; not yet formally verified.
6. Security items seen: CORS `allow_origins=["*"]` with credentials; default JWT secret and plaintext dev credentials in `docker-compose.yml` and `config.py`; JWT is HS256 only.
7. Spec mentions Google Maps, FCM: only `shared/geo.py`, `shared/push.py` stubs exist (not verified as real integrations).
8. package.json name is still `vite-vue-typescript-starter`; `HelloWorld.vue` and `assets/vue.svg` are leftovers.
9. Palette conflict: spec says `#00B19D` primary (also used in vite PWA `theme_color`); `desing.md` says `#00C2A8`. To confirm with the user.
10. Icon conflict: spec says Phosphor/Lucide; `desing.md` says Lucide only (and `@lucide/vue` is the installed package). Treat Lucide as current.
