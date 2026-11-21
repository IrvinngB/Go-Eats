# Apply Progress: improve-customer-checkout

## Unit A1 (PR 1): backend + migration — DONE (not committed)

Branch `feat/checkout-pr1-address-backend`. Tasks 1.1-1.9 complete.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|-----------|-----|-------|-------------|----------|
| 1.1/1.2/1.3 | tests/test_migrations.py (`test_adds_address_columns_idempotent`, `test_address_columns_not_duplicated_on_partial_schema`, `test_fresh_schema_noop` extended) | integration (sqlite) | 16 existing passed | 3 failed (columns `address`/`lng` missing) | 19 passed | legacy vs partial vs fresh schema, run twice, rows keep NULL | none needed |
| 1.4/1.5 | tests/test_users_address.py | API | n/a (new file) | 18 failed, 2 vacuous passes (anon 401, admin list) | 20 passed after schema/service/repo/router; NaN/Infinity cases exposed a real 500 (see deviations), fixed in app/main.py | 9 invalid payloads, NaN/Inf, boundaries, null clears, clear coords only, other user untouched, login | none |
| 1.6/1.7 | tests/test_orders_delivery_coords.py | API | 375 passed | 7 failed (field absent in OrderRead; half/out-of-range accepted) | 386 total passed | valid, none, 5 invalid, NaN/Inf, profile change after order, factory | none |
| 1.8 | tests/factories.py | support | - | exercised by tests above | green | - | - |
| 1.9 | scratchpad pgcheck.py (real PG) | real DB | - | legacy schema verified without columns | see evidence | sequential x2 + 4 concurrent | - |

Full backend suite: `cd backend && .venv/bin/pytest -q` -> 386 passed.

### Evidence (real runs)
- PG: throwaway `postgres:16-alpine` container `goeats-pg-addrcheck` on port 55433 (removed afterwards; project containers untouched). Legacy schema = tables from models with the 5 columns dropped + 3 users + 2 orders. Migration run twice: OK. Re-dropped columns, 4 spawned processes on a `multiprocessing.Barrier`: all `ok`, each column exists exactly once, existing rows NULL, columns `text`/`double precision`, nullable; a final run is a no-op.
- sqlite + uvicorn (throwaway db in scratchpad, deleted): PUT /users/me valid 200; lat 91, lng 181, only lat, NaN, address "abc" -> 422; anonymous 401; null clears; order with coords 201 and returned by GET; half coords and NaN -> 422; profile changed afterwards, old order keeps `8.9824/-79.5199`; admin GET /users/ keys exclude address/lat/lng.
- Frontend untouched: `pnpm test` 536 passed, `vue-tsc -b` 0, `pnpm build` OK, `pnpm test:e2e` 29 passed. `tsconfig.app.tsbuildinfo` restored.

### Files
backend/app/core/migrations.py (`_add_plain_column`), backend/app/shared/coordinates.py (new), backend/app/main.py, users/{models,schemas,service,repository,router}.py, orders/{models,schemas,repository}.py, tests/{factories,test_migrations}.py, tests/test_users_address.py (new), tests/test_orders_delivery_coords.py (new).

### Deviations / notes
- 422 handler in app/main.py: FastAPI echoes the invalid `input` in the 422 body; for NaN/Infinity the JSON encoder raised, giving a 500. Handler returns the same `{detail:[{type,loc,msg}]}` shape without `input`/`ctx`. Applies app-wide (clients lose `input`/`ctx` in 422 details).
- Login response (`UserRead`) includes the caller's OWN address/lat/lng (the notes want the store to map them in `autenticarUsuario`); only the admin list uses `UserListRead` (fields `exclude=True`) and never exposes them.
- Update uses `model_fields_set`; lat/lng must be sent together (even both null).

### Remaining (after A1)
See Unit A2 below; then A3, B, C and Final (6.x).

## Unit A2 (PR 2): picker, geo, store, profile - DONE (not committed)

Branch `feat/checkout-pr2-address-picker`. Tasks 2.1-2.8 complete.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|-----------|-----|-------|-------------|----------|
| 2.1/2.2 | src/utils/geo.spec.ts | unit | n/a (new) | 7 failed: `puntoEnCobertura is not a function` | 7 passed (unrounded haversine, edge inclusive) | centre, 10 m in, 10 m out, far (Colon, Sydney), NaN/Inf | none |
| 2.3/2.4 | src/components/AddressPickerMap.spec.ts | component (jsdom + L.map spy) | n/a (new) | suite failed to load: cannot resolve `./AddressPickerMap.vue` | 28 passed first run; mutation checks (removed disabled guard in click, removed both-or-neither branch) each turned tests red, then restored | click, wrap, drag, typed, 5 invalid cases, limits, half value, clear, labels, hint, coverage in/out/none, no fetch/XHR | none |
| 2.5/2.6 | src/stores/useGoEatsStore.address.spec.ts (new file instead of extending spec.ts: that file's `put` mock is not hoisted) | store | 99 store tests passed | 7 failed (usuario lacked direccion/lat/lng; PUT sent only full_name/phone) | 10 passed, 99 across stores | login + restaurarSesion mapping (set/null), payload, null clearing, lone coord clears both, personal save sends no address keys, trim, 422 and network rollback + toast | none |
| 2.7 | src/views/customer/ProfileView.spec.ts | component | 11 existing passed | 11 failed (no address section) | 22 passed | saved render, empty, save, clear, failure keeps text, short/long address, in-flight disable, coverage hint, personal save unaffected | none |
| 2.8 | scratchpad/pr2/verify.mjs, verify-kb.mjs | real browser + real sqlite + real OSM | - | - | all checks PASS (see below) | click, drag, typed, invalid, out-of-coverage, keyboard-only, clear, reload | - |

### Real verification (throwaway sqlite in scratchpad, uvicorn :8765, vite preview of a VITE_API_URL build :4179, headless Chromium)
Login as carlos@ejemplo.pa through the UI; map click set 8.991566/-79.508057 + address, saved, GET /users/me matched, login payload matched, reload showed text + coords with no hint; marker drag changed the inputs; typed 9.0150/-79.4670 saved; latitude 95 showed the range message; 9.3547/-79.9 showed the soft hint and still saved; keyboard-only (Tab x4 to Latitud, Tab to Longitud, Tab x2 to Guardar, Enter) persisted; clear (text + Quitar ubicacion) left all three null on the server and empty after reload; 360px no horizontal overflow. Hosts contacted: app, API, fonts.googleapis/gstatic (pre-existing), tile.openstreetmap.org (200s); no geocoding host. Servers killed by PID, db deleted.

### Totals
`pnpm test` 592 passed (44 files); `vue-tsc -b` 0; `pnpm build` OK (Leaflet + its CSS only in lazy `mapTiles-*` chunk, `AddressPickerMap-*` chunk imported dynamically from `ProfileView-*`; `index-*` has no Leaflet); `pnpm test:e2e` 29 passed; backend `pytest -q` 386 passed (untouched). tsbuildinfo restored.

### Deviations / notes
- Picker props are `modelValue {lat,lng}|null` + `disabled` (+ optional `altura`), as requested by the caller, not the `{lat, lng, direccion}` of the design note; the address text lives in ProfileView.
- `guardarPerfil`: address keys only sent when present in `datos`; empty text -> `address: null`; a lone lat or lng is sent as null/null (never one without the other); on success the usuario is refreshed from the response when it carries `address`.
- Coordinate inputs are `type=text inputmode=decimal` (not `type=number`) so invalid text can show a message instead of being silently dropped; comma decimals accepted.
- Client-side address limits 4..300 mirror the backend; empty text is allowed (clears).

### Remaining
A3 (checkout wiring), B, C, Final.

## Unit A3 (PR 3): checkout wiring — DONE

Branch `feat/checkout-pr3-checkout-address`. Tasks 3.1-3.3 complete.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|-----------|-----|-------|-------------|----------|
| 3.1/3.2 | src/views/customer/StoreDetailView.spec.ts, src/stores/useGoEatsStore.spec.ts, src/stores/useGoEatsStore.consent.spec.ts | component + store | 592 passed | checkout lacked prefill, override toggle, save-as-default checkbox, coverage warning, coords in order signature | 30 passed in StoreDetailView.spec, 42 in useGoEatsStore.spec, 26 in consent.spec | saved prefill, override without profile save, save-as-default ticked, out-of-coverage warning non-blocking, profile save failure does not rollback order | fixed TS7006 in StoreDetailView.spec.ts:414 |
| 3.3 | e2e/checkout-address.spec.ts | E2E (Playwright real browser) | 29 passed | new spec | 3 passed (32 total E2E) | prefilled saved address, override out-of-coverage without PUT /users/me, save-as-default triggers PUT /users/me | none |

### Totals
`pnpm test` 622 passed (44 files); `vue-tsc -b` 0; `pnpm build` OK (`AddressPickerMap` lazy chunk loaded only on "Cambiar para este pedido"); `pnpm test:e2e` 32 passed; backend `pytest -q` 386 passed. `tsconfig.app.tsbuildinfo` restored.

### Files
src/views/customer/StoreDetailView.vue, src/views/customer/StoreDetailView.spec.ts, src/stores/useGoEatsStore.js, src/stores/useGoEatsStore.spec.ts, src/stores/useGoEatsStore.consent.spec.ts, e2e/checkout-address.spec.ts.

### Remaining
B (simulated gateway), C (catalog browsing), Final.

## Unit B (PR 4): simulated gateway — DONE

Branch `feat/checkout-pr4-simulated-gateway`. Tasks 4.1-4.6 complete (+ Playwright E2E network traffic assertion).

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|-----------|-----|-------|-------------|----------|
| 4.1/4.2 | src/utils/card.spec.ts | unit | n/a (new) | module `./card` missing | 5 passed | Luhn approve/decline/formatted/invalid, brand detection, MM/YY vs reference Date, CVV 3-4, full form Spanish errors | none |
| 4.3 | src/components/PaymentGatewayModal.spec.ts | component | n/a (new) | module `./PaymentGatewayModal.vue` missing | 3 passed | card -> OTP -> processing -> result, invalid Luhn/expiry/CVV/OTP blocks, fields wiped on close, zero leakage to Pinia/Storage/console | spied Storage.prototype.setItem for Node 22 jsdom compatibility |
| 4.4/4.5 | src/views/customer/StoreDetailView.spec.ts, e2e/checkout-address.spec.ts | component + store + E2E | 622 passed | old single-button modal lacked card/OTP steps and demo-gated `simulate_failure` | 31 passed in StoreDetailView.spec, 33 in Playwright E2E | `/payments/` keys strictly `['method','order_code']` when flag off (even with decline card); `simulate_failure: true` only with `VITE_ENABLE_DEMO_SWITCHER='true'` + decline card; zero card fields in raw HTTP bodies | extracted `PaymentGatewayModal.vue` |
| 4.6 | backend/tests/test_payments.py | backend API | 386 passed | - | 24 passed in test_payments.py | unchanged backend honors `simulate_failure` only under `DEV_SIMULATE_FAILURE` | none |

### Totals
`pnpm test` 631 passed (46 files); `vue-tsc -b` 0; `pnpm build` OK; `pnpm test:e2e` 33 passed; backend `pytest -q tests/test_payments.py` 24 passed (full suite 386 passed). `tsconfig.app.tsbuildinfo` restored.

### Files
src/utils/card.ts (new), src/utils/card.spec.ts (new), src/components/PaymentGatewayModal.vue (new), src/components/PaymentGatewayModal.spec.ts (new), src/stores/useGoEatsStore.js, src/views/customer/StoreDetailView.vue, src/views/customer/StoreDetailView.spec.ts, e2e/checkout-address.spec.ts.

### Remaining
C (catalog browsing), Final.

## Unit C (PR 5) + Final: catalog browsing & steering/changelog — DONE

Branch `feat/checkout-pr5-catalog-browsing`. Tasks 5.1-5.6 and 6.1-6.2 complete.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|-----------|-----|-------|-------------|----------|
| 5.2/5.3 | src/utils/catalog.spec.ts | unit | n/a (new) | module `./catalog` missing | 5 passed | accent/case-insensitive search, promo detection, unique category extraction, merchant filter+sort (relevance/rating/name), product filter | none |
| 5.4 | src/stores/useGoEatsStore.spec.ts | store | 42 passed | extended promo price test to assert `categoria` | 42 passed | effective `precio`, `precioRegular`, `categoria` | none |
| 5.5 | src/views/customer/StoresView.spec.ts | component | n/a (new) | 3 failed (`merchant-card`, `stores-category`, `merchant-status` absent) | 3 passed | accent-insensitive search, empty state + clear filters, category chips, sort by name/rating, `Abierto`/`Cerrado` badge and disabled closed cards | neutral Spanish copy in map caption |
| 5.6 | src/views/customer/StoreDetailView.spec.ts | component | 31 passed | 3 failed (`promo-badge`, `product-card`/`products-category`, `closed-merchant-notice` absent) | 33 passed | promo badge when `precioRegular > precio`, product search & category chips, empty state, closed merchant notice & disabled add-to-cart | avoided `.input` class on menu search input so existing checkout `.input` selector stays unambiguous |

### Totals
`pnpm test` 641 passed (48 files); `vue-tsc -b` 0; `pnpm build` OK; `pnpm test:e2e` 33 passed; backend `pytest -q` 386 passed. `tsconfig.app.tsbuildinfo` restored.

### Files
src/utils/catalog.ts (new), src/utils/catalog.spec.ts (new), src/views/customer/StoresView.vue, src/views/customer/StoresView.spec.ts (new), src/views/customer/StoreDetailView.vue, src/views/customer/StoreDetailView.spec.ts, src/stores/useGoEatsStore.spec.ts, keel/steering/tech.md, changelog.md.

## Catalog design-system restyle (branch style/catalog-design-system)

Goal: customer catalog (StoresView + browsing part of StoreDetailView) follows desing.md "Friendly Bento". No behavior change; search/filter/sort/promo/closed logic and src/utils/catalog.ts untouched.

### Approach
- New scoped stylesheet `src/components/catalog/catalog.css` under `.cx` (light only, `--cx-*` tokens) + `src/components/catalog/tokens.ts` (`extra` tokens, `catalogTheme = light + extra`, `catalogPairs()`). landing.css, landing tests, tokens.ts `light/dark`, tailwind.config.js, style.css untouched. `vite.config.ts`: `css.include` now also `/catalog\.css/` so specs can read it raw.
- Fonts: Nunito 400/700/800 imported by the two lazy views only. Headings/buttons/chips Nunito, body Inter.
- Rule `.cx :is(h1,h2,h3,h4)` re-scopes the global heading color (same cascade bug as the landing).
- Layout: bento header (hero tile radius 32 primary-tint + indigo supporting tile), 12-col on lg, merchant tiles 24px with concentric 16px cover, compact 16px product tiles, flat (no border/shadow), lip only on `.cx-btn`. One solid primary per view (cart FAB / empty-state button); "Agregar" uses the secondary variant.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|-----------|-----|-------|-------------|----------|
| token sync CSS vs tokens.ts | src/components/catalog/catalog.spec.ts | unit (raw CSS) | n/a (new) | import of missing catalog.css failed | 39 passed | exact equality light+extra; every landing key keeps its value; no dark values/scheme rules; radii scale; shadow whitelist; no gradient/blur | reworded 2 CSS comments that tripped the "no prefers-color-scheme" assertion |
| no white on primary, dark on-primary | catalogDesign.spec.ts + catalog.spec.ts | unit (raw SFC/CSS) | n/a (new) | 7 failed against old Tailwind views | 8 passed | both views, template only (drawer excluded for Tailwind-class checks) | regex narrowed after `merchant-card`/`cx-btn-secondary` false positives |
| contrast of new pairs | catalog.spec.ts (`catalogPairs`) | unit | n/a | n/a (data-driven) | 26 pairs pass | text >= 4.5, UI >= 3; plus test documenting that desing.md success/danger on their tints fail 4.5 | status text tokens darkened |
| empty state, closed merchant, promo, chips | StoresView.spec.ts, StoreDetailView.spec.ts | component | 6 + 33 passed | new tests failed on old markup | 193 passed in src/views + catalog | open vs closed, promo vs no promo, selected vs unselected chip, filters vs clear action | none |
| real browser | e2e/catalog-design.spec.ts (17 tests) | e2e | n/a | - | 17 passed | 360x800 and 1440x900; light/dark scheme/html.dark | selector + fab-close fixes |

Cascade proof: removed the `.cx :is(h1,h2,h3,h4)` rule, rebuilt, heading tests failed (Expected rgb(11, 43, 51), Received rgb(44, 62, 80), the global `text-ink`), rule restored, green again.
Real bug found by the e2e "no white text on primary" scan: the cart drawer's "Continuar"/"Realizar pedido" buttons (`btn-primary` = white on turquoise) sit inside `.cx`; swapped to `cx-btn cx-btn-lg` (class only, handlers untouched).

### Edited existing tests
- src/views/customer/StoreDetailView.spec.ts: `button.btn-primary` -> `[data-test="add-to-cart"]` (openCheckout helper and closed-merchant test); added 4 tests.
- src/views/customer/StoresView.spec.ts: appended 3 tests (no existing assertion changed).
- e2e/checkout-address.spec.ts line 119: `h2:has-text("Menú") + div button.btn-primary` -> `[data-test="add-to-cart"]` (button class changed; flow identical).
- Not edited: landing specs, guards.spec.ts, PaymentGatewayModal specs.

### Visual self-review (vite preview of the build, API mocked with page.route, screenshots in the session scratchpad: list, list+filter, list empty, detail promo, detail closed, detail empty, detail+cart at 1440 and 360)
Fixed after review: zone chips stacked in 3 rows on mobile (now a horizontal scroller with room for the focus ring); sort select now full width on mobile.
Remaining flaws (honest):
- Merchant covers cycle three pale tints (primary/secondary/amber) so a grid shows many tonal tiles; with hero + indigo tile that is more than "two brand tones per viewport" on desktop. Calm enough but arguably a bit "pile of tiles".
- No hero among the merchant tiles (all equal size); the bento hero is the header only. Merchants have no photos, so covers are icon-on-tint, a placeholder until real imagery exists.
- Mobile uses 1 column for merchant tiles (desing.md says 2); the tiles carry too much text for 170px.
- Product thumbs are the same Utensils icon: monotone until product images exist.
- Focused search input shows border + outline (double ring).
- Drawer, checkout form, PaymentGatewayModal, TopBar (blur) and the global toast still use the old Tailwind look: out of scope.
- Contrast deviations from desing.md: success/warning/danger text on their tints are 4.30/4.48/3.98 (< 4.5) so text uses `*-text` steps; `ink-faint` on `surface-strong` is 4.27 so disabled text uses `ink-soft`.
- Dark theme not implemented (future change add-theme-mode).

### Verification
`pnpm test` 697 passed (50 files); `pnpm exec vue-tsc -b` 0; `pnpm build` OK; `pnpm test:e2e` 50 passed (33 previous + 17 new; checkout-address needed the selector edit above); backend `pytest -q` 386 passed (untouched). `tsconfig.app.tsbuildinfo` restored. Own preview server (port 4174) stopped by PID.

### Earlier real-browser tasks never executed
Tasks 3.4, 4.7 and 5.7 were merged without their real-browser checks. Only 5.7 was addressed here, partially: closed merchant + promo product were verified in real Chromium against a MOCKED API (not a seeded throwaway backend), see the closed/promo e2e tests and screenshots. 5.7 is marked in tasks.md as such; 3.4 and 4.7 remain open (they need a throwaway backend, including DEV_SIMULATE_FAILURE for 4.7).

## Customer shell restyle (branch `style/customer-pr1-shell`, PR 1 of 4)

Scope: `TopBar.vue` (shared by all 5 roles), `PwaStatus.vue` banners, global toast in `App.vue`, `LoginView.vue`. Same light `.cx` scope as PR #37, extended in `src/components/catalog/catalog.css` (new "Customer shell" section); no new tokens (token-sync test untouched), new contrast pairs in `catalog/tokens.ts` `shellPairs()`.

- TopBar: flat 64px, `--bg`, 1px bottom `--border`, no backdrop blur; items `.text-label` (hover `--surface`, `aria-current` = `--primary-tint` + `--primary-text`); account trigger + overlay menu (24px radius, concentric 16px rows, Escape closes and returns focus); anonymous "Iniciar sesión" is a secondary button (single primary per view). Customers also get Explorar / Mis pedidos / Perfil inside the account menu under 768px (the nav was hidden there, so phones had no way to them).
- PwaStatus: offline strip in warning tint; update/install are overlay cards (secondary action button, 44px dismiss).
- Toast: `--ink` / `--bg`, 16px radius, bottom-center above a 64px nav (bottom 88px), icon + text for info / success / error, persistent polite live region, `role="alert"` + manual dismiss on errors. Store timing (2.8s auto-dismiss for every type, PR8) deliberately unchanged, so errors still auto-dismiss: desing.md asks for "errors stay until dismissed" and that needs a store change (out of scope).
- LoginView: hero tile (indigo) + form tile on a `--surface` canvas; chips for login/register (aria-pressed + check); 52px inputs with visible labels, leading icons, 2px danger + icon + message on error (`aria-invalid`, `aria-describedby`); accessible consent checkbox (real input + custom box, dark tick on primary); submit inside a `<form>` so Enter works; dark text with the 4px lip on the only primary.

Strict TDD: RED first (`shell.spec.ts` 21 failing, `App.toast.spec.ts` 6, TopBar restyle block 8+, LoginView restyle block), then GREEN. Real contrast finding: `primary-text` on `surface-strong` is 4.49 (< 4.5), so hover states on that fill keep `--ink` text (asserted in `shell.spec.ts`).

Evidence: `pnpm test` 52 files / 755 tests pass; `vue-tsc -b` clean; `pnpm build` ok; `pnpm test:e2e` 76 passed (26 new in `e2e/customer-shell.spec.ts`: computed styles, no overflow at 360x800 and 1440x900, keyboard walk of bar and form with 2px primary-text ring, dark scheme / `html.dark` do not recolor, anonymous vs customer vs merchant bar, 360px menu behavior, toasts, proof that deleting `.cx :is(h1,h2,h3,h4)` turns headings `#2C3E50`/Inter); backend `pytest -q` 386 passed (untouched).

Existing tests edited (selectors/measurement only): `TopBar.spec.ts` (menu trigger selector `header button.rounded-full` -> `[data-test="account-trigger"]`), `LoginView.spec.ts` (submit selector `button.btn-primary` -> `[data-test="login-submit"]`, 6 places), `e2e/guards.spec.ts` (same trigger selector), `e2e/catalog-design.spec.ts` (two 44px target tests now read `offsetHeight/offsetWidth`: `boundingBox()` measured the 220ms selected-chip pop at scale .94 = 41.36px; the race surfaced because catalog.css now loads with the entry chunk).

Visual self-review (Playwright against `pnpm build` + preview on 4174, screenshots outside the repo) found and fixed: hero paragraph margin lost to `.cx p{margin:0}`, menu touching the bar border, form tabs jumping between login/register on desktop. Remaining flaws: login hero tile is sparse (no mascot/illustration yet); phones have no bottom nav (destinations live in the account menu); name/role hidden in the bar under 640px; toast sits at 88px even where no nav exists; install/update card and toast can overlap for a moment at the bottom; profile/orders pages under the bar still use the legacy look (later PRs).
