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

### Remaining
Units A2, A3, B, C and Final (6.x).
