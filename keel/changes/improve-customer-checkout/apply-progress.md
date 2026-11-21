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
