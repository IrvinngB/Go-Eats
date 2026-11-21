# Proposal: Improve Customer Checkout (address, simulated gateway, catalog browsing)

## Intent
Three "mini fixes" for the customer flow: the delivery address is a free-text input that is lost (users have no address/lat/lng, orders store text only); payment is one "Pagar (simulado)" button; catalog browsing has no search/filters/open-closed state. Decisions in `state.yaml` are user-approved (lean path, Strict TDD, no images).

## Scope

### In Scope
- Unit 1 Address: nullable `users.address/lat/lng` + `orders.delivery_lat/lng`; `AddressPickerMap` (Leaflet, OSM tiles via `src/utils/mapTiles.ts`, click/drag pin, no geocoding API/keys); profile saves default via PATCH `/users/me` (PR8 `escribir`: typed errors + rollback); checkout prefilled, "Cambiar para este pedido", profile untouched unless "Guardar como mi dirección"; order stores text+coords snapshot (frozen, doc 3.4); server validation (lat -90..90, lng -180..180, both-or-neither, text min length as today); soft warning (not a block) outside all zones using `COORDENADAS_ZONAS`/`radioM`.
- Unit 2 Gateway: multi-step simulated modal (card form with Luhn/format validation + test-card hints, 3-D Secure-style OTP, processing, approved/declined). Card number/expiry/CVV/holder stay in component memory only: never sent, logged, stored, or put in Pinia. Backend still receives only `order_code` + `method`. Decline test card sends `simulate_failure=true` only when `VITE_ENABLE_DEMO_SWITCHER` is on and backend honors it only with `DEV_SIMULATE_FAILURE` (PR3/PR7); prod builds always approve. Decline cancels order (PR7).
- Unit 3 Catalog (no images): client-side name search, category filter (merchant `category_type`, product `category`), promo badge (`promo_price` vs `price`), `is_open` closed state with ordering disabled, sorting, empty state. Reads only fields the API already exposes (mapper in `useGoEatsStore.js` ~L325-358 must also keep list price, frontend-only).
- Spanish copy, a11y (labels, keyboard, focus, aria), real-browser check per unit with throwaway DB/volume.

### Out of Scope
- Courier/merchant views showing the pin; real geocoding; real PSP; images; any change to catalog/merchants backend schemas, models, routers.

## Capabilities

### New Capabilities
- `customer-delivery-address`: profile default address, map pin, per-order override, coords snapshot, validation, coverage warning.
- `customer-payment-gateway-sim`: multi-step simulated gateway, client-only card data, demo-only decline.
- `customer-catalog-browsing`: search, filters, promo badges, open/closed, sort, empty state.

### Modified Capabilities
- `customer-orders-pricing`: orders gain delivery coords snapshot and validation.
- `customer-payments`: unchanged API contract; gateway UX precedes the existing call.

## Approach
Stacked PRs into `develop` (merge commits), order address -> gateway -> catalog, branched only after improve-customer-role PR10 merges. Extend `backend/app/core/migrations.py` with an idempotent `ADD COLUMN` helper (same advisory-lock/savepoint pattern, tests as PR2/PR5); `create_all` never alters existing tables. Pure helpers (Luhn, point-in-zone, filters) unit-tested first.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/app/core/migrations.py` | Modified | nullable column migration |
| `backend/app/domains/users/{models,schemas,service}.py` | Modified | address/lat/lng, PATCH `/users/me` |
| `backend/app/domains/orders/{models,schemas}.py` | Modified | delivery_lat/lng + validation |
| `src/components/AddressPickerMap.vue` | New | reusable pin picker |
| `src/components/PaymentGatewayModal.vue` | New | multi-step gateway |
| `src/views/customer/{ProfileView,StoreDetailView,StoresView}.vue` | Modified | address, gateway, browsing |
| `src/stores/useGoEatsStore.js`, `src/utils/geo.js` | Modified | guardarPerfil, crearPedido, coverage helper, mapper |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Schema change on existing volume | Med | idempotent nullable columns, migration tests run twice, throwaway DB |
| Leaflet pin not accessible | High | lat/lng inputs + text address as keyboard-equivalent, aria-live, focusable map |
| PCI-DSS wording implies real compliance | Med | copy says "simulado"; no card data persisted/logged/in store |
| Overlap with improve-merchant-role (category/promo_price) | Med | frontend reads existing fields only; depends on its shape; rebase before unit 3 |
| OSM tile usage policy | Med | attribution, no bulk/prefetch, existing tile config; swap-able provider |
| Order-time coords drift from profile | Low | snapshot copied at order creation |

## Rollback Plan
Revert each unit's merge commit independently (reverse order). New columns are nullable and unused after revert, so they stay harmlessly; no destructive down-migration. Gateway revert restores the single-button modal.

## Dependencies
- improve-customer-role PR10 merged; merge-role session's category/promo_price fields (read-only).

## Success Criteria
- [ ] Profile address persists; checkout override doesn't change it unless ticked; order keeps frozen text+coords
- [ ] Invalid/half coords rejected 422; out-of-zone shows warning only
- [ ] Card data absent from network requests, logs, DB, store
- [ ] Decline works only with demo flag + DEV_SIMULATE_FAILURE; prod always approves
- [ ] Closed merchants cannot be ordered from; search/filter/sort/empty state work
- [ ] Migration idempotent on existing DB; tests green; real-browser check per unit
