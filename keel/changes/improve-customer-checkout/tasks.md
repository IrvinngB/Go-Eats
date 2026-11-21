# Tasks: Improve Customer Checkout (address, simulated gateway, catalog browsing)

**DEPENDENCY: nothing is applied until improve-customer-role PR10 (`feat/customer-pr10-guards`) is merged to `develop`.** Branch every PR from `develop` after that. Lean path: no spec/clarify/design; decisions live below. Strict TDD: each task names its RED test first.

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

Estimated changed lines: ~1,550-1,900 total · Delivery strategy: stacked PRs into `develop` (merge commits), auto mode (user-approved). No size exception needed.

| PR | Unit | Est. lines | Risk |
|----|------|-----------|------|
| 1 | A1 backend + migration | 300-380 | Low |
| 2 | A2 geo helper, AddressPickerMap, store, ProfileView | 320-420 | Medium |
| 3 | A3 checkout wiring | 220-300 | Low |
| 4 | B gateway | 420-520 | Medium (if >450 at apply, split card validators into their own PR) |
| 5 | C catalog browsing | 250-350 | Low |

Each PR must pass `cd backend && .venv/bin/pytest -q`, `pnpm test`, `pnpm exec vue-tsc -b`, `pnpm build`, `pnpm test:e2e`. Bases: PR1 -> develop; each next PR targets develop after the previous merges (or the previous PR branch while stacked).

## Design notes (corrections to the proposal in bold)

- **Profile endpoint is `PUT /users/me`** (not PATCH); `UserUpdate` is partial via `None`. Address fields use `model_fields_set` so explicit null clears all three.
- Schema (all nullable): `users.address TEXT`, `users.lat FLOAT`, `users.lng FLOAT`, `orders.delivery_lat FLOAT`, `orders.delivery_lng FLOAT`. Existing `_add_column` in `core/migrations.py` hardcodes `INTEGER REFERENCES users(id)`: add a generic `_add_plain_column(conn, table, column, sqltype)` with the same savepoint/duplicate handling, inside the existing advisory lock.
- Validation (pydantic, shared helper): lat -90..90, lng -180..180, `allow_inf_nan=False`, both-or-neither (422). Profile address 4..300 chars. Order `delivery_address` min 4 unchanged. Coords frozen on the order at creation, copied from the payload only (never from the profile server-side).
- **`UserRead` also feeds `GET /users/` (admin list) and login**: exclude address/lat/lng from the admin list (`response_model_exclude`) to avoid new PII exposure. Audit text never includes coords.
- Coverage lives only in the frontend (`COORDENADAS_ZONAS` centre + `radioM` in `src/utils/geo.js`; backend zones have no geometry). New `puntoEnCobertura(lat,lng)` via `calcularDistanciaKm` (km) vs `radioM/1000`. Warning only, never blocks.
- `AddressPickerMap.vue` props `{lat, lng, direccion}`, emits `update:lat|lng|direccion` / `change`. Leaflet with `TILE_URL`/`TILE_ATTRIBUTION` from `src/utils/mapTiles.ts`; click and drag set the pin; keyboard path = text input + numeric lat/lng inputs, `aria-label`s, `aria-live` status; no geocoding, no keys.
- Store: `usuario` gains `direccion, lat, lng` (mapped in `restaurarSesion`/`autenticarUsuario`); `guardarPerfil` sends them via `escribir`; `crearPedido({direccion, lat, lng, ...})` adds them to the retry `firma`; `mapPedidoApi` maps `delivery_lat/lng` (order views unchanged).
- Gateway: `src/components/PaymentGatewayModal.vue` (extracted from StoreDetailView) + `src/utils/card.ts` (Luhn, expiry, CVV, brand). Steps: card -> OTP -> processing -> approved/declined. Card number/expiry/CVV/holder are component-local refs only, cleared on close/unmount. Only the processing step calls `crearPedido`; `/payments` body = `{order_code, method}` plus `simulate_failure: true` only when `DEMO_SWITCHER` (src/config.ts) AND the decline test card was used. Backend unchanged (honors it only with `DEV_SIMULATE_FAILURE`).
- **Catalog mapper already keeps `precioRegular` (list price) next to the effective `precio`** (PR7): no mapper change needed, only tests that pin it. Backend catalog/merchants untouched.

## Unit A1 (PR 1): backend + migration

- [x] 1.1 RED `backend/tests/test_migrations.py::test_adds_address_columns_idempotent`: legacy DDL (users/orders minimal) gains 5 nullable columns; runs twice; existing rows keep NULLs.
- [x] 1.2 GREEN `backend/app/core/migrations.py`: `_add_plain_column` + call for users/orders when tables exist; extend `test_fresh_schema_noop` columns.
- [x] 1.3 Add columns to `users/models.py` and `orders/models.py` (Float, Text, nullable).
- [x] 1.4 RED `backend/tests/test_users_address.py`: PUT /users/me saves address+lat+lng; lat 91, lng 181, NaN, only lat -> 422; null clears; another user's data untouched; anonymous 401; admin list omits address/coords.
- [x] 1.5 GREEN `users/schemas.py`, `users/service.py`, `users/repository.py`, `users/router.py` (exclude on list).
- [x] 1.6 RED `backend/tests/test_orders_delivery_coords.py`: create with valid coords stores them in OrderRead; half/out-of-range -> 422; no coords -> NULL; profile change after order does not alter the order.
- [x] 1.7 GREEN `orders/schemas.py` (OrderCreate validator, OrderRead fields), `orders/repository.py` create.
- [x] 1.8 Extend `backend/tests/factories.py` (`make_user` address/lat/lng, `make_order` delivery_lat/lng).
- [x] 1.9 Throwaway postgres:16 container (scratchpad, random port; never the project volume): load legacy schema, run `run_startup_migrations` twice, then 4 concurrent workers; assert columns once and no errors; remove container.

## Unit A2 (PR 2): picker, geo, store, profile

- [ ] 2.1 RED `src/utils/geo.spec.ts`: `puntoEnCobertura` inside/outside/edge of a zone.
- [ ] 2.2 GREEN `src/utils/geo.js`.
- [ ] 2.3 RED `src/components/AddressPickerMap.spec.ts` (jsdom, L.map spy like CoverageMap.spec): click sets pin and emits; marker drag emits; typed lat/lng inputs move the pin; invalid values show message; labels present; no network call.
- [ ] 2.4 GREEN `src/components/AddressPickerMap.vue`.
- [ ] 2.5 RED `src/stores/useGoEatsStore.spec.ts`: `guardarPerfil` PUTs address/lat/lng, rolls back and toasts on failure; `restaurarSesion` maps them.
- [ ] 2.6 GREEN store (`usuario`, `guardarPerfil`, mappers); update `src/vite-env.d.ts` only if needed.
- [ ] 2.7 RED `ProfileView.spec.ts`: address section renders saved default, saves through the store, keeps text on failure; GREEN `src/views/customer/ProfileView.vue`.
- [ ] 2.8 Real-browser check (Playwright MCP or `pnpm dev`) against a throwaway sqlite backend in the scratchpad (never `goeats.db`): save profile address, reload, persists.

## Unit A3 (PR 3): checkout

- [ ] 3.1 RED `StoreDetailView.spec.ts`: checkout prefilled from profile; "Cambiar para este pedido" edits only the order; "Guardar como mi dirección" (default off) updates the profile only when ticked; out-of-coverage pin shows warning and still allows ordering; order POST carries delivery_lat/lng.
- [ ] 3.2 GREEN `StoreDetailView.vue` and `crearPedido` (firma includes coords).
- [ ] 3.3 RED/GREEN `e2e/checkout-address.spec.ts` (stubbed API, like `e2e/guards.spec.ts`).
- [ ] 3.4 Real-browser check on throwaway backend: order stores frozen coords; changing the profile later does not change the old order.

## Unit B (PR 4): simulated gateway

- [ ] 4.1 RED `src/utils/card.spec.ts`: Luhn valid/invalid, expiry past/format, CVV 3-4, test-card hints (approve, decline).
- [ ] 4.2 GREEN `src/utils/card.ts`.
- [ ] 4.3 RED `src/components/PaymentGatewayModal.spec.ts`: step order card -> OTP -> processing -> result; invalid card blocks; copy says "simulado"; fields cleared on close; Pinia state, localStorage, console contain no card data.
- [ ] 4.4 RED payload test (`StoreDetailView.spec.ts` with mocked api): `/payments` body keys exactly `['order_code','method']`; decline card adds `simulate_failure` only with `VITE_ENABLE_DEMO_SWITCHER='true'` (`vi.stubEnv`); prod build never sends it and approves; no card field in any request.
- [ ] 4.5 GREEN `PaymentGatewayModal.vue`, `crearPedido` option for simulate_failure, wire in `StoreDetailView.vue`; declined shows cancelled order (PR7 behavior); update existing "Pagar (simulado)" spec.
- [ ] 4.6 Backend regression: existing `test_payments.py` flag tests stay green (no backend change).
- [ ] 4.7 Real-browser check on throwaway backend with `DEV_SIMULATE_FAILURE=true` and a demo build: approve path and decline path cancel the order; inspect network tab for card data.

## Unit C (PR 5): catalog browsing (frontend only)

- [ ] 5.1 **Rebase on `develop` after improve-merchant-role merges, before starting.**
- [ ] 5.2 RED `src/utils/catalog.spec.ts`: name search (case/accent-insensitive), category filter, sort, promo detection from `precioRegular > precio`.
- [ ] 5.3 GREEN `src/utils/catalog.ts`.
- [ ] 5.4 RED `src/stores/useGoEatsStore.spec.ts`: mapper keeps `precio` (effective) and `precioRegular` (list), `categoria`.
- [ ] 5.5 RED `src/views/customer/StoresView.spec.ts` (new): search, `category_type` chips, sort, empty state, closed merchants visibly disabled with label; GREEN `StoresView.vue`.
- [ ] 5.6 RED/GREEN `StoreDetailView.spec.ts`: product search, category filter, promo badge, closed merchant disables add-to-cart and shows notice.
- [ ] 5.7 Real-browser check on throwaway backend with seeded closed merchant and promo product.

## Final

- [ ] 6.1 Update `keel/steering/tech.md` (new columns, migration helper, gateway/card data rules, DEMO_SWITCHER use, coverage helper) and `changelog.md` (Added/Changed/Security per unit).
- [ ] 6.2 Confirm no `goeats.db`, project docker volume, or scratchpad leftovers committed.
