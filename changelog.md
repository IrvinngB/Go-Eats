# Changelog

All notable changes to Go Eats are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project aims to follow [Semantic Versioning](https://semver.org/). No release has been tagged yet, so everything below is under `Unreleased`.

## [Unreleased]

### Added

- Customer delivery address, simulated payment gateway, and catalog browsing (`improve-customer-checkout`):
  - Nullable `users.address`, `users.lat`, `users.lng` and `orders.delivery_lat`, `orders.delivery_lng` columns via idempotent `_add_plain_column` startup migration (`backend/app/core/migrations.py`) and shared coordinate validation (`backend/app/shared/coordinates.py`).
  - `AddressPickerMap.vue` (Leaflet + OSM tiles, click/drag pin, keyboard lat/lng inputs) and `puntoEnCobertura` helper (`src/utils/geo.js`) with non-blocking coverage warning in `ProfileView.vue` and `StoreDetailView.vue`.
  - Checkout delivery address prefill from profile, per-order override ("Cambiar para este pedido"), and optional "Guardar como mi dirección" checkbox.
  - Multi-step simulated payment gateway (`PaymentGatewayModal.vue`, `src/utils/card.ts`) with Luhn, expiry, CVV, brand detection, and 3-D Secure OTP steps.
  - Customer catalog browsing (`src/utils/catalog.ts`, `StoresView.vue`, `StoreDetailView.vue`): accent-insensitive search, category filter chips, sorting, promo badges (`precioRegular > precio`), and closed-merchant ordering block.

### Changed

- `PUT /users/me` updates and clears default delivery address and coordinates; `POST /orders/` snapshots `delivery_lat` and `delivery_lng` on the created order.
- `StoreDetailView.vue` delegates electronic payment confirmation to `PaymentGatewayModal.vue`.

### Security

- Cardholder name, card number, expiry, CVV, and OTP stay strictly in component-local refs inside `PaymentGatewayModal.vue` and are wiped before network calls and on close/unmount; `POST /payments/` still receives only `{ order_code, method }` (plus `simulate_failure: true` only when `VITE_ENABLE_DEMO_SWITCHER=true` at build time and the decline test card is used).
- Admin `GET /users/` response (`UserListRead`) excludes `address`, `lat`, and `lng` to avoid exposing customer location PII.
- Custom 422 validation handler in `backend/app/main.py` strips raw `input`/`ctx` to prevent `NaN`/`Infinity` serialization 500 errors.

- Spec-Driven Development (SDD) bootstrap under `keel/`, using the git-tracked `files` store.
  - `keel/config.yaml`: detected stack, verified commands, `strict_tdd: true`, `security_review: true`.
  - `keel/steering/product.md`, `keel/steering/tech.md`, `keel/steering/structure.md`: project steering documents.
- SDD change `add-landing-page`, planned up to (not including) apply, in `keel/changes/add-landing-page/`:
  - `proposal.md`: public landing page at `/` following the Friendly Bento design system (`desing.md`), plus a frontend test runner.
  - `specs/landing-page/spec.md` and `specs/frontend-testing/spec.md`: new capabilities with RFC 2119 requirements and Given/When/Then scenarios.
  - `clarifications.md`, `design.md`, `blast-radius.md`, `tasks.md`.
- Planned, not yet implemented: vitest, `@vue/test-utils` and jsdom with a `pnpm test` script (work unit 1).
- Project documentation: `arquitectura_tech_stack_y_rf_go_eats.md` (stack, architecture, RF-01 to RF-20) and `desing.md` (design system).

### Decisions

- Artifact store is `keel/` (git-tracked `files` backend).
- Strict TDD is ON. No test runner exists yet, so the first work unit installs one.
- `security_review` is ON for the verify phase (JWT, RBAC and Ley 81 data protection are in scope).
- `add-landing-page` ships as 4 chained PRs (`stacked-to-main`): test infrastructure, router and app shell, tokens, components. The forecast is about 850 to 1100 changed lines, excluding the lockfile, against a 400-line review budget.
- Landing primary color is `#00B19D` with dark text on top. Both `#00B19D` and `#00C2A8` fail 4.5:1 contrast on white, so they are fills only.
- Dark theme is applied through `prefers-color-scheme` or a `.dark` class, with a `[data-theme="dark"]` alias.
- Icons use `@lucide/vue`, which is already installed.
- The PWA `start_url: /` will open the landing page instead of `/tiendas`. Accepted.
- The global `.page-enter` transition stays outside the landing reduced-motion rule. Accepted and documented.
- `og:image` and the Inter Google Fonts link are left untouched.

### Known issues

Recorded in `keel/steering/tech.md`, none fixed yet:

- No CI and no Terraform, although the architecture document requires GitHub Actions and Terraform.
- Alembic has no `versions/` directory, and `alembic.ini` points to sqlite while `docker-compose.yml` uses Postgres.
- The Pinia store still mixes `mockData.js` with API calls, and some store writes swallow errors with `.catch(() => {})`.
- Order state strings are duplicated in `backend/app/domains/orders/service.py` (`en_preparacion` and `en preparación`, also `en camino`, `listo para recoger`), and `seed.py` uses the spaced form.
- Cross-domain imports (`orders` to `delivery`, `reports` to `merchants`, `orders` and `payments`, `auth` to `users`) are not formally checked against the no-service-import rule.
- No DB-level append-only enforcement was found for the audit tables.
- CORS is `*` with credentials, and default JWT and database secrets are present in `docker-compose.yml` and `config.py`.
- `shared/geo.py` and `shared/push.py` are not verified as real Google Maps and FCM integrations.
- The package name is still `vite-vue-typescript-starter`, with leftover `HelloWorld.vue` and `vue.svg`.
- `TopBar` renders on every route except `/login`, with `backdrop-blur` and a mock account switcher. The landing change hides it on `/`.
- No test files exist on either frontend or backend.
