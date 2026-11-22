# Functional Requirements (RF-01 to RF-20) & SDD QA Compliance Report

All **20 Functional Requirements (`RF-01` through `RF-20`)** defined in [arquitectura_tech_stack_y_rf_go_eats.md](../arquitectura_tech_stack_y_rf_go_eats.md) are implemented, verified under **Strict TDD** (`pytest` + `Vitest` + `Playwright`), and governed by canonical **Keel SDD** specifications under [keel/specs/](../keel/specs/).

## Quick QA Verification Path

1. **Run the automated test suites**:
   ```bash
   # Backend API, RBAC, ownership, pricing, payments & migrations (416 tests)
   cd backend && .venv/bin/pytest -q

   # Frontend unit, store, component & build-gating tests (50 test files)
   pnpm test

   # TypeScript & Vue template typecheck
   pnpm exec vue-tsc -b

   # Real-browser Playwright E2E suite (33 tests)
   pnpm test:e2e
   ```
2. **Start or refresh the local Docker stack**:
   ```bash
   docker compose up -d --build
   ```
3. **Sign in to `http://localhost:5173/login`** using the role accounts below (all use password `demo1234`).

---

## QA Role Accounts (`password: demo1234`)

| Role | Route | Primary QA Account | Linked Entity / Scope |
|------|-------|--------------------|-----------------------|
| **Customer** (`customer`) | `/tiendas`, `/pedidos`, `/perfil` | `carlos@ejemplo.pa` | Owns seeded customer orders; default profile address & ARCO |
| **Merchant** (`merchant`) | `/panel-comercio` | `hector.endara@ejemplo.pa` | Linked to merchant `c1` (*Restaurante Diablicos*) |
| **Merchant (Closed)** | `/panel-comercio` | `patricia.motta@ejemplo.pa` | Linked to merchant `c2` (*Verde Bistro*) |
| **Courier** (`courier`) | `/panel-repartidor` | `javier.morales@ejemplo.pa` | Linked to courier `r1` |
| **Courier** (`courier`) | `/panel-repartidor` | `maria.cedeno@ejemplo.pa` | Linked to courier `r2` |
| **Accountant** (`accountant`) | `/panel-contabilidad` | `contabilidad@goeats.pa` | Full payment ledger, reconciliation & PDF receipts |
| **Administrator** (`admin`) | `/panel-admin` | `admin@goeats.pa` | Live KPIs, user status, merchant/courier affiliations, ARCO & audit log |

---

## RF-01 to RF-20 Traceability Matrix

| Code | Priority | Role | Requirement Summary | Frontend Implementation | Backend Implementation | Keel Spec & Automated Tests |
|------|----------|------|---------------------|-------------------------|------------------------|-----------------------------|
| **RF-01** *(RQ-01)* | **M** | Merchant | Assign ready orders to registered, available couriers | `src/views/merchant/MerchantView.vue` | `PATCH /api/v1/orders/{code}/courier`, `GET /api/v1/delivery/couriers?available=true` (`orders/service.py`) | `keel/specs/merchant-catalog-management/spec.md` · `backend/tests/test_status.py`, `backend/tests/test_merchant_role.py`, `MerchantView.spec.ts` |
| **RF-02** *(RQ-02)* | **M** | Courier | Manage availability status (`En línea` / `Ocupado` / `Desconectado`) | `src/views/courier/CourierView.vue` | `PATCH /api/v1/delivery/couriers/{code}/availability`, `GET /api/v1/delivery/couriers/me` (`delivery/service.py`) | `keel/specs/courier-delivery-management/spec.md` · `backend/tests/test_courier_role.py`, `CourierView.spec.ts` |
| **RF-03** *(RQ-03)* | **M** | Customer | Real-time order tracking and assigned courier details | `src/views/customer/OrdersView.vue`, `src/components/orders/OrderActive.vue`, `src/components/CoverageMap.vue` | `GET /api/v1/orders/`, `GET /api/v1/orders/{code}` (`orders/service.py`) | `keel/specs/order-status-normalization/spec.md` · `OrdersView.spec.ts`, `OrdersView.tracking.spec.ts` |
| **RF-04** *(RQ-04)* | **M** | Customer | Browse affiliated merchants by coverage zone | `src/views/customer/StoresView.vue`, `src/utils/geo.js`, `src/components/CoverageMap.vue` | `GET /api/v1/zones/`, `GET /api/v1/merchants/?zone={slug}` (`merchants/service.py`) | `keel/specs/landing-page/spec.md` · `StoresView.spec.ts`, `geo.spec.ts`, `CoverageMap.spec.ts` |
| **RF-05** *(RQ-05)* | **M** | Customer | Explore available product catalog of a selected merchant | `src/views/customer/StoreDetailView.vue`, `src/utils/catalog.ts` | `GET /api/v1/catalog/products`, `GET /api/v1/catalog/merchants/{code}/products` (`catalog/service.py`) | `StoreDetailView.spec.ts`, `catalog.spec.ts` |
| **RF-06** *(RQ-06)* | **M** | Customer | View complete product details (description, regular/promo price, category, availability) before ordering | `src/views/customer/StoreDetailView.vue` | `GET /api/v1/catalog/products/{id}` (`catalog/router.py`) | `StoreDetailView.spec.ts`, `catalogDesign.spec.ts` |
| **RF-07** *(RQ-07)* | **S** | All | User registration with mandatory Ley 81 data-protection consent | `src/views/LoginView.vue` | `POST /api/v1/auth/register` (`auth/service.py`, `data_consents` table) | `keel/specs/customer-consent-arco/spec.md` · `backend/tests/test_consent.py`, `LoginView.spec.ts` |
| **RF-08** *(RQ-08)* | **M** | All | Credential login with strict role-based access control (RBAC) and route guards | `src/guards.ts`, `src/router.ts`, `src/views/LoginView.vue` | `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `app/core/rbac.py` | `keel/specs/customer-authorization/spec.md`, `keel/specs/session-and-route-guards/spec.md` · `backend/tests/test_auth.py`, `guards.spec.ts`, `e2e/guards.spec.ts` |
| **RF-09** *(RQ-09)* | **S** | All | Update user profile, default map delivery address, consent toggle, and exercise ARCO rights | `src/views/customer/ProfileView.vue`, `src/components/AddressPickerMap.vue` | `GET/PUT /api/v1/users/me`, `GET/PUT /api/v1/users/me/consent`, `GET/POST /api/v1/users/me/arco` (`users/service.py`) | `keel/specs/customer-consent-arco/spec.md` · `backend/tests/test_users_address.py`, `backend/tests/test_consent.py`, `ProfileView.spec.ts`, `AddressPickerMap.spec.ts` |
| **RF-10** *(RQ-10)* | **M** | Customer | Electronic payment (multi-step simulated gateway) and cash on delivery without storing card data | `src/components/PaymentGatewayModal.vue`, `src/utils/card.ts`, `src/views/customer/StoreDetailView.vue` | `POST /api/v1/payments/` (`payments/service.py`, `payments/providers.py`) | `keel/specs/customer-payments/spec.md` · `backend/tests/test_payments.py`, `PaymentGatewayModal.spec.ts`, `card.spec.ts`, `e2e/checkout-address.spec.ts` |
| **RF-11** *(RQ-11)* | **M** | Accountant | Historical transaction ledger, financial KPIs, 12% commissions, and payment reconciliation | `src/views/accountant/AccountingView.vue` | `GET /api/v1/payments/`, `PATCH /api/v1/payments/{code}/status`, `GET /api/v1/reports/financial` | `keel/specs/accountant-financial-reconciliation/spec.md` · `backend/tests/test_accountant_role.py`, `AccountingView.spec.ts` |
| **RF-12** *(RQ-12)* | **M** | Accountant / Customer | Generate and download digital payment receipts in PDF format | `src/views/accountant/AccountingView.vue`, `src/stores/useGoEatsStore.js` | `GET /api/v1/payments/{code}/receipt.pdf` (`payments/service.py`, `shared/storage.py`) | `keel/specs/accountant-financial-reconciliation/spec.md` · `backend/tests/test_payments.py`, `backend/tests/test_accountant_role.py`, `AccountingView.spec.ts` |
| **RF-13** | **M** | Merchant | Manage catalog: products, categories, regular & promo prices, product deletion, schedules, and open/close state | `src/views/merchant/MerchantView.vue` | `POST /api/v1/catalog/merchants/{code}/products`, `PUT/DELETE /api/v1/catalog/products/{id}`, `PUT /api/v1/merchants/{code}/schedule` | `keel/specs/merchant-catalog-management/spec.md` · `backend/tests/test_merchant_role.py`, `MerchantView.spec.ts` |
| **RF-14** | **M** | Customer | Build shopping cart and confirm order with item notes, delivery address, and frozen GPS coordinates | `src/views/customer/StoreDetailView.vue` | `POST /api/v1/orders/` (`orders/service.py` server-side pricing & address snapshot) | `keel/specs/customer-orders-pricing/spec.md` · `backend/tests/test_pricing.py`, `backend/tests/test_orders_delivery_coords.py`, `StoreDetailView.spec.ts`, `e2e/checkout-address.spec.ts` |
| **RF-15** | **M** | Customer | Display estimated delivery fee calculated from zone tariff and distance | `src/views/customer/StoreDetailView.vue`, `src/views/customer/StoresView.vue` | `app/shared/geo.py` (`calculate_delivery_fee`), `orders/service.py` | `keel/specs/customer-orders-pricing/spec.md` · `backend/tests/test_pricing.py` |
| **RF-16** | **M** | Merchant / Courier | Update order state with async push notification and mandatory reason on cancel/reject | `src/views/merchant/MerchantView.vue`, `src/views/courier/CourierView.vue` | `PATCH /api/v1/orders/{code}/status` (`VALID_TRANSITIONS`, `ROLE_TARGETS`, `REASON_REQUIRED`, `BackgroundTasks` push) | `keel/specs/order-status-normalization/spec.md` · `backend/tests/test_status.py`, `MerchantView.spec.ts`, `CourierView.spec.ts` |
| **RF-17** | **S** | Admin | Query operational reports, immutable audit logs, and key performance indicators (KPIs) | `src/views/admin/AdminView.vue` | `GET /api/v1/reports/kpis`, `GET /api/v1/reports/audit-logs` (`reports/service.py`) | `keel/specs/admin-platform-governance/spec.md` · `backend/tests/test_reports_revenue.py`, `backend/tests/test_admin_role.py`, `AdminView.spec.ts` |
| **RF-18** | **M** | Admin | Manage user accounts (`is_active`) and approve/suspend merchant and courier affiliations | `src/views/admin/AdminView.vue` | `GET /api/v1/users/`, `PATCH /api/v1/users/{id}/status`, `PATCH /api/v1/merchants/{code}/affiliation`, `PATCH /api/v1/delivery/couriers/{code}/affiliation` | `keel/specs/admin-platform-governance/spec.md` · `backend/tests/test_admin_role.py`, `AdminView.spec.ts` |
| **RF-19** | **M** | Courier | View pickup merchant, customer contact, address, GPS coordinates, package items, and delivery notes | `src/views/courier/CourierView.vue` | `GET /api/v1/orders/` (courier-scoped in `orders/service.py`) | `keel/specs/courier-delivery-management/spec.md` · `backend/tests/test_orders_scope.py`, `CourierView.spec.ts` |
| **RF-20** | **S** | Customer | Rate merchant service and courier attention once the order is delivered | `src/views/customer/OrdersView.vue`, `src/components/orders/RatingStars.vue` | `POST /api/v1/orders/{code}/rating` (`orders/service.py`) | `keel/specs/customer-authorization/spec.md` · `backend/tests/test_orders_scope.py`, `OrdersView.spec.ts`, `RatingStars.spec.ts` |

---

## Intentional Demo & Local-First Scope Notes

1. **Simulated Payment Gateway (`RF-10`)**: Cardholder name, PAN, expiry, CVV, and 3-D Secure OTP are validated client-side (`Luhn` + format rules in `src/utils/card.ts`) and wiped from component memory before any network call. `POST /api/v1/payments/` never receives or logs card numbers.
2. **OpenStreetMap & Haversine Zone Coverage (`RF-03`, `RF-04`)**: Uses Leaflet with OpenStreetMap tiles (`src/utils/mapTiles.ts`) and radial zone coverage (`COORDENADAS_ZONAS` + Haversine in `src/utils/geo.js`) so QA can test maps and pin placement without external Google Maps billing keys.
3. **Async Push Notification Adapter (`RF-16`)**: Triggered via FastAPI `BackgroundTasks` (`backend/app/shared/push.py`) on order creation and status transitions without requiring external Firebase Cloud Messaging credentials.

## QA Checklist

- [x] **Customer flow**: Browse `/tiendas` with search/category chips -> open merchant -> filter menu -> add items -> override or save map delivery address -> pay via simulated 3-D Secure gateway -> track order in `/pedidos` -> rate delivered order.
- [x] **Merchant flow**: Sign in as `hector.endara@ejemplo.pa` -> toggle store open/closed -> create/edit product with category and promo price -> delete product -> advance order `pendiente -> confirmado -> en_preparacion -> listo_para_recoger` -> assign available courier.
- [x] **Courier flow**: Sign in as `javier.morales@ejemplo.pa` -> verify `En línea` / `Ocupado` / `Desconectado` states -> inspect package items, notes, and GPS coordinates -> mark `en_camino` -> mark `entregado`.
- [x] **Admin flow**: Sign in as `admin@goeats.pa` -> verify live `/reports/kpis` cards -> approve/suspend merchants and couriers -> filter user accounts and suspend/reactivate a non-self user -> resolve pending ARCO request -> filter audit logs.
- [x] **Accountant flow**: Sign in as `contabilidad@goeats.pa` -> verify 12% commission and net payout KPIs -> reconcile a `pendiente` transaction to `aprobado` (`pagado`) -> preview digital receipt and download PDF.
