# Changelog

All notable changes to **Go Eats** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Render Blueprint (`render.yaml`): FastAPI web service, static PWA with SPA rewrite, Postgres 16. `DATABASE_URL` is normalized to `postgresql+psycopg://`.

### Fixed
- Passwords over 72 UTF-8 bytes return `422` on register and `401` on login instead of a `500` from `bcrypt>=5`.
- Account suspension (`RF-17`) applies on the next request: `get_current_user` checks `users.is_active` instead of trusting the access token for up to 30 minutes.
- Electronic (`yappy`) orders cannot move forward (`confirmado`, …) without an approved payment; reject/cancel stay allowed.
- Concurrent payments for one order are serialized with `SELECT … FOR UPDATE OF orders`, so the second one gets `409`.
- Login shows "cuenta suspendida" (403) and server/validation messages instead of always "No se pudo conectar".
- Axios timeout raised from 10 s to 60 s so the first request after a free-tier sleep does not fail.

### Added (abuse limits)
- Customers hold at most 5 `pendiente` orders at once (`409` beyond that).
- `POST /orders/` honours an `Idempotency-Key` header (unique per customer): a replay returns the original order with `200`. The PWA sends one key per checkout attempt.
- In-process rate limits (`429` + `Retry-After`): login 10/min per IP, register 5/10 min per IP, order and payment creation 10/min per user. Client IP comes from `True-Client-IP` (Cloudflare, in front of Render).
- Unpaid `yappy` orders are cancelled after 15 minutes ("Pago no completado a tiempo"), lazily on order reads and creation.
- One open ARCO request per type per user (`409`).
- At most 200 products per merchant (`409`); product `description` ≤ 1000 and `category` ≤ 60 characters.
- `POST /orders/{code}/cancel`: the customer cancels their own order while it is `pendiente` and unpaid, with a two-tap button in "Mis pedidos". `PATCH /orders/{code}/status` stays closed to customers.

### Security
- Production (`RENDER=true` or `APP_ENV=production`) refuses to start with a missing or default `JWT_SECRET_KEY`.
- Size caps: order `notes` 500, item `notes` 200, `delivery_address` 300, status `reason` 500, rating `comment` 1000, max 30 cart lines.

---

## [1.0.0] - 2026-11-22

### Added
- **QA & SDD Compliance Documentation (`PR #52`, `PR #53`)**:
  - Added [`docs/rf-compliance-report.md`](./docs/rf-compliance-report.md) with the complete `RF-01` to `RF-20` traceability matrix, seeded QA credentials, test commands, and role-by-role acceptance checklist.
  - Updated [`README.md`](./README.md) with the **Keel Spec-Driven Development (SDD)** workflow, archived changes index (`keel/changes/archive/`), and canonical specifications guide (`keel/specs/`).
- **Accountant Role Release (`improve-accountant-role` — `PR #50`, `RF-11`, `RF-12`)**:
  - Executive financial KPIs (`Volumen aprobado`, `Comisiones 12%`, `Neto a comercios`, `Pendientes por conciliar`) and `GET /api/v1/reports/financial` store synchronization (`store.cargarResumenFinanciero`).
  - Transaction search (by `TX-...`, `PED-...`, customer, merchant, or gateway reference) and direct reconciliation actions (`Conciliar` -> `pagado`, `Fallido` -> `fallido`) in `AccountingView.vue`.
  - Direct PDF receipt download (`GET /api/v1/payments/{code}/receipt.pdf`) alongside the digital receipt preview modal.
  - Added `backend/tests/test_accountant_role.py`, `src/views/accountant/AccountingView.spec.ts`, and [`keel/specs/accountant-financial-reconciliation/spec.md`](./keel/specs/accountant-financial-reconciliation/spec.md).
- **Administrator Role Release (`improve-admin-role` — `PR #49`, `RF-17`, `RF-18`, `RF-09`)**:
  - Added `PATCH /api/v1/users/{user_id}/status` (`UserStatusUpdate.is_active`) allowing administrators to suspend or reactivate user accounts with self-suspension protection (`400 Bad Request`) and audit logging.
  - Wired `AdminView.vue` to live `GET /api/v1/reports/kpis` (`store.cargarPanelAdmin`) and `GET /api/v1/users/`.
  - Added platform couriers affiliation governance table (`PATCH /api/v1/delivery/couriers/{code}/affiliation`), `Usuarios` management tab (search + role filter chips + suspend/reactivate), and audit log category filters.
  - Added `backend/tests/test_admin_role.py`, `src/views/admin/AdminView.spec.ts`, and [`keel/specs/admin-platform-governance/spec.md`](./keel/specs/admin-platform-governance/spec.md).

### Security
- Tightened `PaymentStatusUpdate.status` in `backend/app/domains/payments/schemas.py` to `Literal["pagado", "pendiente", "fallido"]` (`422 Unprocessable Entity` on invalid status strings).
- Prevented administrator self-suspension on `PATCH /api/v1/users/{user_id}/status`.

---

## [0.5.0] - 2026-11-21

### Added
- **Courier Role Release (`improve-courier-role` — `PR #48`, `RF-02`, `RF-16`, `RF-19`)**:
  - Tri-state operational indicator (`En línea`, `Ocupado` when an active order is `en_camino`, `Desconectado` when offline) and delivery KPI strip (`Por recoger`, `En camino`, `Completadas`) in `CourierView.vue`.
  - Complete `RF-19` delivery card displaying pickup merchant, customer phone & address, frozen GPS coordinates (`GPS: lat, lng`), package item breakdown (`cantidad × nombre` + item notes), order notes, and collection status.
  - Added `backend/tests/test_courier_role.py`, extended `src/views/courier/CourierView.spec.ts`, and added [`keel/specs/courier-delivery-management/spec.md`](./keel/specs/courier-delivery-management/spec.md).
- **Merchant Role Release (`improve-merchant-role` — `PR #47`, `RF-01`, `RF-13`, `RF-16`)**:
  - Added `DELETE /api/v1/catalog/products/{product_id}` (`204 No Content`) with merchant ownership validation and audit logging.
  - Full `RF-13` catalog management in `MerchantView.vue`: product `category` and `promo_price` creation/editing (with `0 < promo_price < price` validation and `-X%` discount badge), product deletion, catalog search & category filter chips, and 1-click header store open/close toggle (`PUT /api/v1/merchants/{code}/schedule`).
  - Added `backend/tests/test_merchant_role.py`, extended `src/views/merchant/MerchantView.spec.ts`, and added [`keel/specs/merchant-catalog-management/spec.md`](./keel/specs/merchant-catalog-management/spec.md).
- **Opt-In Demo Catalog Generator (`PR #40`)**:
  - Deterministic, idempotent CLI generator (`backend/app/seed_demo_catalog.py`, `backend/tests/test_seed_demo_catalog.py`) to populate 150 fictional merchants and ~1,500 products across active zones for local demos.

### Changed
- **Customer Friendly Bento & Delivery-App Redesign (`PR #37` – `PR #43`)**:
  - Applied the Friendly Bento design system across `StoresView.vue`, `StoreDetailView.vue`, `OrdersView.vue`, `ProfileView.vue`, `LoginView.vue`, and `TopBar.vue` (cover headers, horizontal dish cards with floating `+` action, accessible dialogs via `useDialogo.ts`, and count-aware grids via `src/utils/grid.ts`).
- Archived `improve-customer-role`, `improve-customer-checkout`, and `redesign-landing-page` into `keel/changes/archive/` (`PR #45`, `PR #46`).

### Fixed
- **Customer Order Identity (`PR #44`)**: Matched `pedidosComoCliente` by authenticated account ID (`customer_id === usuario.id`) instead of display name to prevent collisions.

### Security
- **Merchant Ownership Enforcement (`RF-08`, `RF-13`)**: `PUT /api/v1/merchants/{code}/schedule` and `POST/PUT/DELETE /api/v1/catalog/...` enforce `merchant.owner_user_id == current_user.user_id` (`403 Forbidden` on foreign/unlinked merchants).
- **Courier Ownership & Active-Affiliation Enforcement (`RF-02`)**: `PATCH /api/v1/delivery/couriers/{code}/availability` enforces `courier.user_id == current_user.user_id` (`403 Forbidden` on foreign/unlinked couriers) and blocks suspended couriers from going online (`400 Bad Request`).
- **Courier Assignment State Guard (`RF-01`)**: `PATCH /api/v1/orders/{code}/courier` rejects assigning a courier to orders already `en_camino` or in terminal states (`entregado`, `cancelado`, `rechazado`).

---

## [0.4.0] - 2026-11-20

### Added
- **Customer Checkout, Address Picker, Simulated Gateway & Catalog Browsing (`improve-customer-checkout` — `PR #31` – `PR #36`)**:
  - Nullable `users.address`, `users.lat`, `users.lng` and `orders.delivery_lat`, `orders.delivery_lng` columns via idempotent `_add_plain_column` startup migration (`backend/app/core/migrations.py`) and shared coordinate validation (`backend/app/shared/coordinates.py`).
  - `AddressPickerMap.vue` (Leaflet + OSM tiles, click/drag pin, keyboard lat/lng inputs) and `puntoEnCobertura` helper (`src/utils/geo.js`) with non-blocking coverage hint in `ProfileView.vue` and `StoreDetailView.vue`.
  - Checkout delivery address prefill from profile, per-order override (`"Cambiar para este pedido"`), and optional `"Guardar como mi dirección"` checkbox (`e2e/checkout-address.spec.ts`).
  - Multi-step simulated payment gateway (`PaymentGatewayModal.vue`, `src/utils/card.ts`) with Luhn, brand detection, MM/YY expiry, CVV, and 6-digit 3-D Secure OTP steps.
  - Customer catalog browsing (`src/utils/catalog.ts`, `StoresView.vue`, `StoreDetailView.vue`): accent-insensitive search, category chips, sorting (`Relevancia`, `Mejor calificados ★`, `Nombre A-Z`), promo badges, and closed-merchant ordering block.

### Changed
- Removed reference zone circles from `AddressPickerMap.vue` so the delivery pin picker renders a clean street map (`25f3232`).

### Security
- **Zero Card-Data Leakage (`RF-10`)**: Cardholder name, PAN, expiry, CVV, and 3-D Secure OTP stay strictly in component-local refs inside `PaymentGatewayModal.vue` and are wiped before network calls and on close/unmount; `POST /api/v1/payments/` receives only `{ order_code, method }` (plus `simulate_failure` gated by build-time `VITE_ENABLE_DEMO_SWITCHER=true` and server-side `DEV_SIMULATE_FAILURE=true`).
- Admin `GET /api/v1/users/` response (`UserListRead`) excludes `address`, `lat`, and `lng` to prevent customer location PII exposure.
- Custom 422 validation handler in `backend/app/main.py` strips raw `input`/`ctx` to prevent `NaN`/`Infinity` serialization 500 errors.

---

## [0.3.0] - 2026-11-20

### Added
- **Customer Role Security, Pricing, Payments, Consent/ARCO & Canonical States (`improve-customer-role` — `PR #20` – `PR #30`)**:
  - Backend `pytest` harness (`backend/tests/conftest.py`, `factories.py`) with isolated in-memory SQLite engine.
  - Entity ownership linking (`merchants.owner_user_id`, `couriers.user_id`) with idempotent advisory-locked startup migrations (`backend/app/core/migrations.py`, `backend/app/shared/entity_links.py`), plus `GET /api/v1/merchants/mine` and `GET /api/v1/delivery/couriers/me`.
  - Server-side order pricing and delivery fee computation (`orders/service.py`, `shared/geo.py`), unique sequence code allocation (`shared/codes.py`), and customer-owned order rating (`POST /api/v1/orders/{code}/rating`).
  - Ley 81 consent endpoints (`GET/PUT /api/v1/users/me/consent`) and self-scoped ARCO listing (`GET /api/v1/users/me/arco`).
  - Frontend route guards (`src/guards.ts`, `e2e/guards.spec.ts`), session restoration before first navigation (`src/main.ts`), and typed write wrapper with automatic rollback (`store.escribir`, `src/services/errors.ts`).

### Changed
- Normalized all order status strings to canonical `snake_case` (`pendiente`, `confirmado`, `en_preparacion`, `listo_para_recoger`, `en_camino`, `entregado`, `rechazado`, `cancelado`) and excluded `rechazado`/`cancelado` from revenue KPIs.
- Replaced monolithic `Promise.all` in `sincronizarConBackend` with role-gated `Promise.allSettled`.

### Security
- **Login & Registration Role Hardening (`RF-08`)**: `POST /api/v1/auth/login` ignores client-supplied `role` unless runtime `DEV_ROLE_OVERRIDE=true`; `POST /api/v1/auth/register` always creates `customer` accounts; `POST /api/v1/auth/refresh` reloads the stored user role and rejects suspended users.
- **Role-Scoped Reads & Writes**: Locked `GET /api/v1/orders/`, `GET /api/v1/orders/{code}`, `GET /api/v1/payments/`, `GET /api/v1/reports/*`, and `GET /api/v1/users/arco` to authenticated role scopes.
- **Demo Credentials Gating (`PR #30`)**: Stripped demo switcher credentials from production bundles (`VITE_ENABLE_DEMO_SWITCHER=false` by default, verified by `tests/build/demoGating.build.spec.ts`).

---

## [0.2.0] - 2026-11-20

### Added
- **Public Marketplace Landing Page & E2E Infrastructure (`add-landing-page`, `redesign-landing-page` — `PR #1` – `PR #19`)**:
  - Public landing page at `/` (`src/views/landing/LandingView.vue`, `src/components/landing/*`) with Friendly Bento tokens (`#00B19D`), brand wordmarks (`src/assets/brand/*`), live featured stores/zones (`useLandingData.ts`), lazy coverage map (`CoverageSection.vue`), PWA install section (`useInstallPrompt.ts`), FAQ accordion, and footer.
  - Frontend `Vitest` + `@vue/test-utils` + `jsdom` test runner (`pnpm test`) and real-browser `Playwright` E2E runner (`pnpm test:e2e`, `e2e/landing.spec.ts`, `e2e/landing-behavior.spec.ts`).
  - Spec-Driven Development (SDD) bootstrap under `keel/` (`keel/config.yaml`, `keel/steering/*`, `keel/specs/landing-page/spec.md`, `keel/specs/frontend-testing/spec.md`).

### Fixed
- Replaced dead CartoDB map tiles with OpenStreetMap standard tiles (`src/utils/mapTiles.ts`, `PR #11`).
- Enforced WCAG AA heading contrast on landing components (`PR #7`).

---

## [0.1.0] - 2026-11-16

### Added
- Initial full-stack Go Eats platform foundation:
  - Vue 3 + Vite 5 + Pinia + Vue Router 4 + Tailwind CSS 3 + `vite-plugin-pwa` frontend with views for all 5 roles (`customer`, `merchant`, `courier`, `accountant`, `admin`).
  - FastAPI + SQLAlchemy 2 + PostgreSQL 16 + Alembic 9-domain modular monolith (`auth`, `users`, `zones`, `merchants`, `catalog`, `delivery`, `orders`, `payments`, `reports`) with initial seed data (`backend/app/seed.py`).
  - Multi-container Docker Compose stack (`postgres`, `minio`, `api`, `web` with Caddy reverse proxy) and architectural specification (`arquitectura_tech_stack_y_rf_go_eats.md`, `desing.md`).
