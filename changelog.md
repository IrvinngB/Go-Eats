# Changelog

All notable changes to Go Eats are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **QA & SDD Documentation (`docs(qa)`)**:
  - Added [`docs/rf-compliance-report.md`](./docs/rf-compliance-report.md) with the complete `RF-01` to `RF-20` traceability matrix, seeded role credentials, verification commands, and role-by-role QA checklist.
  - Updated [`README.md`](./README.md) with the **Keel Spec-Driven Development (SDD)** workflow, archived changes index (`keel/changes/archive/`), and canonical specifications guide (`keel/specs/`).
- **Accountant Role (`improve-accountant-role` — RF-11, RF-12)**:
  - Executive financial KPIs (`Volumen aprobado`, `Comisiones 12%`, `Neto a comercios`, `Pendientes por conciliar`) and `GET /api/v1/reports/financial` integration (`store.cargarResumenFinanciero`).
  - Transaction search (by `TX-...`, `PED-...`, customer, merchant, or gateway reference) and direct reconciliation controls (`Conciliar` -> `pagado`, `Fallido` -> `fallido`) in `AccountingView.vue`.
  - Direct PDF receipt download (`GET /api/v1/payments/{code}/receipt.pdf`) alongside the digital receipt preview modal.
  - Added `backend/tests/test_accountant_role.py`, `src/views/accountant/AccountingView.spec.ts`, and `keel/specs/accountant-financial-reconciliation/spec.md`.
- **Administrator Role (`improve-admin-role` — RF-17, RF-18, RF-09)**:
  - Added `PATCH /api/v1/users/{user_id}/status` (`UserStatusUpdate.is_active`) allowing admins to suspend or reactivate user accounts with self-suspension protection (`400 Bad Request`) and audit logging.
  - Live operational KPIs wired to `GET /api/v1/reports/kpis` (`store.cargarPanelAdmin`) replacing static mock counters in `AdminView.vue`.
  - Added platform couriers affiliation governance table (`PATCH /api/v1/delivery/couriers/{code}/affiliation` via `store.cambiarEstadoRepartidor`), `Usuarios` management tab (search + role filter chips + suspend/reactivate), and audit log category filters in `AdminView.vue`.
  - Added `backend/tests/test_admin_role.py`, `src/views/admin/AdminView.spec.ts`, and `keel/specs/admin-platform-governance/spec.md`.
- **Courier Role (`improve-courier-role` — RF-02, RF-16, RF-19)**:
  - Tri-state operational badge (`En línea`, `Ocupado` when an active order is `en_camino`, `Desconectado` when offline) and delivery KPI strip (`Por recoger`, `En camino`, `Completadas`) in `CourierView.vue`.
  - Complete `RF-19` delivery card displaying pickup merchant, customer phone & address, frozen GPS coordinates (`GPS: lat, lng`), package item breakdown (`cantidad × nombre` + item notes), order notes, and collection status (`Cobrar B/ X.XX contra entrega` vs `Pagado en línea`).
  - Added `backend/tests/test_courier_role.py`, extended `src/views/courier/CourierView.spec.ts`, and added `keel/specs/courier-delivery-management/spec.md`.
- **Merchant Role (`improve-merchant-role` — RF-01, RF-13, RF-16)**:
  - Added `DELETE /api/v1/catalog/products/{product_id}` (`204 No Content`) with merchant ownership validation and audit logging.
  - Full `RF-13` catalog management in `MerchantView.vue`: product `category` and `promo_price` creation/editing (with `0 < promo_price < price` validation and `-X%` discount badge), product deletion, catalog search & category filter chips, and 1-click header store open/close toggle (`PUT /api/v1/merchants/{code}/schedule`).
  - Delivery Partner dashboard header with live KPIs (`Pedidos activos`, `Listos p/ repartidor`, `Platos en menú`, `En promoción`) and order state filters (`Todos`, `Nuevos`, `En cocina`, `Listos`).
  - Added `backend/tests/test_merchant_role.py`, extended `src/views/merchant/MerchantView.spec.ts`, and added `keel/specs/merchant-catalog-management/spec.md`.
- **Customer Checkout, Address Picker, Simulated Gateway & Catalog Browsing (`improve-customer-checkout` — RF-04, RF-05, RF-06, RF-09, RF-10, RF-14)**:
  - Nullable `users.address`, `users.lat`, `users.lng` and `orders.delivery_lat`, `orders.delivery_lng` columns via idempotent `_add_plain_column` startup migration (`backend/app/core/migrations.py`) and shared coordinate validation (`backend/app/shared/coordinates.py`).
  - `AddressPickerMap.vue` (Leaflet + OSM tiles, click/drag pin, keyboard lat/lng inputs) and `puntoEnCobertura` helper (`src/utils/geo.js`) with non-blocking coverage hint in `ProfileView.vue` and `StoreDetailView.vue`.
  - Checkout delivery address prefill from profile, per-order override (`"Cambiar para este pedido"`), and optional `"Guardar como mi dirección"` checkbox (`e2e/checkout-address.spec.ts`).
  - Multi-step simulated payment gateway (`PaymentGatewayModal.vue`, `src/utils/card.ts`) with Luhn, brand detection, MM/YY expiry, CVV, and 6-digit 3-D Secure OTP steps.
  - Customer catalog browsing (`src/utils/catalog.ts`, `StoresView.vue`, `StoreDetailView.vue`): accent-insensitive search, category chips, sorting (`Relevancia`, `Mejor calificados ★`, `Nombre A-Z`), promo badges, and closed-merchant ordering block.
- **Customer Role Core, RBAC, Pricing, Consent/ARCO & Canonical States (`improve-customer-role` — RF-03, RF-07, RF-08, RF-09, RF-10, RF-14, RF-15, RF-16, RF-20)**:
  - Backend `pytest` harness (`backend/tests/conftest.py`, `factories.py`) with isolated in-memory SQLite engine.
  - Entity ownership linking (`merchants.owner_user_id`, `couriers.user_id`) with idempotent advisory-locked startup migrations (`backend/app/core/migrations.py`, `backend/app/shared/entity_links.py`), plus `GET /api/v1/merchants/mine` and `GET /api/v1/delivery/couriers/me`.
  - Server-side order pricing and delivery fee computation (`orders/service.py`, `shared/geo.py`), unique sequence code allocation (`shared/codes.py`), and customer-owned order rating (`POST /api/v1/orders/{code}/rating`).
  - Ley 81 consent endpoints (`GET/PUT /api/v1/users/me/consent`) and self-scoped ARCO listing (`GET /api/v1/users/me/arco`).
  - Frontend route guards (`src/guards.ts`), session restoration before first navigation (`src/main.ts`), typed write wrapper with automatic rollback (`store.escribir`, `src/services/errors.ts`), and customer order tracking & rating components (`src/components/orders/*`).
- **Public Landing Page & Test Infrastructure (`add-landing-page`, `redesign-landing-page`)**:
  - Public marketplace landing page at `/` (`src/views/landing/LandingView.vue`, `src/components/landing/*`) with live API featured stores/zones, lazy Leaflet coverage map, PWA install prompt (`useInstallPrompt.ts`), FAQ accordion, and footer.
  - Frontend `Vitest` + `@vue/test-utils` + `jsdom` suite and real-browser `Playwright` E2E suite (`e2e/landing.spec.ts`, `e2e/landing-behavior.spec.ts`, `e2e/guards.spec.ts`, `e2e/checkout-address.spec.ts`).
- **Opt-In Demo Catalog Generator**:
  - Deterministic, idempotent CLI generator (`backend/app/seed_demo_catalog.py`, `backend/tests/test_seed_demo_catalog.py`) to populate 150 fictional merchants and ~1,500 products across active zones for local demos.

### Changed

- Redesigned `StoresView.vue`, `StoreDetailView.vue`, `MerchantView.vue`, `CourierView.vue`, `AdminView.vue`, and `AccountingView.vue` with a unified delivery-marketplace visual language (cover banners, sticky search/category bars, horizontal dish cards with floating `+` action, and executive KPI strips).
- Removed reference zone circles from `AddressPickerMap.vue` so the delivery pin picker displays a clean street map.
- Normalized all order status values across database, backend transitions, seed data, and frontend views to canonical `snake_case` (`pendiente`, `confirmado`, `en_preparacion`, `listo_para_recoger`, `en_camino`, `entregado`, `rechazado`, `cancelado`) and excluded `rechazado`/`cancelado` from revenue KPIs.
- Replaced monolithic `Promise.all` in `sincronizarConBackend` with role-gated `Promise.allSettled` so unauthorized or failed private endpoints never drop public catalog data.

### Security

- **Login & Registration Role Hardening (`RF-08`)**: `POST /api/v1/auth/login` ignores client-supplied `role` unless runtime `DEV_ROLE_OVERRIDE=true`; `POST /api/v1/auth/register` always creates `customer` accounts; `POST /api/v1/auth/refresh` reloads the stored user role and rejects suspended users (`is_active=False`).
- **Entity Ownership Enforcement (`RF-01`, `RF-02`, `RF-13`)**:
  - `PUT /api/v1/merchants/{code}/schedule` and `POST/PUT/DELETE /api/v1/catalog/...` verify `merchant.owner_user_id == current_user.user_id` (`403 Forbidden` on foreign/unlinked merchants).
  - `PATCH /api/v1/delivery/couriers/{code}/availability` verifies `courier.user_id == current_user.user_id` (`403 Forbidden` on foreign/unlinked couriers) and blocks suspended couriers from going online (`400 Bad Request`).
  - `GET /api/v1/orders/`, `GET /api/v1/orders/{code}`, `PATCH /api/v1/orders/{code}/status`, `PATCH /api/v1/orders/{code}/courier`, `POST /api/v1/orders/{code}/rating`, and `GET /api/v1/payments/{code}/receipt.pdf` enforce strict caller ownership/role scope (`404` out of scope).
- **Zero Card-Data Leakage (`RF-10`)**: Cardholder name, PAN, expiry, CVV, and 3-D Secure OTP live strictly in component-local refs inside `PaymentGatewayModal.vue` and are wiped before network calls and on close/unmount; `POST /api/v1/payments/` accepts only `{ order_code, method }` (plus `simulate_failure` gated by build-time `VITE_ENABLE_DEMO_SWITCHER=true` and server-side `DEV_SIMULATE_FAILURE=true`).
- **Ley 81 Consent & PII Protection (`RF-07`, `RF-09`)**: Revoked consent blocks `POST /api/v1/orders/` and `POST /api/v1/payments/` with `403 consent_required`; `GET /api/v1/users/` excludes `address`, `lat`, and `lng` via `UserListRead`; demo credentials and account switcher are stripped from production bundles (`tests/build/demoGating.build.spec.ts`).
- **Validation Hardening**: Tightened `PaymentStatusUpdate.status` to `Literal["pagado", "pendiente", "fallido"]`; custom 422 handler in `backend/app/main.py` strips raw `input`/`ctx` to prevent `NaN`/`Infinity` JSON serialization 500 errors.
