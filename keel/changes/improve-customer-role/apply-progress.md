# Apply progress: improve-customer-role

## PR1 (tasks 1.1-1.5) - DONE, not committed
Branch: feat/customer-pr1-backend-harness (stacked, base develop).

### Working commands (reuse in later PRs)
- Create venv (NEVER default python3 = 3.14): `python3.12 -m venv backend/.venv`
- Install: `backend/.venv/bin/pip install -r backend/requirements-dev.txt`
- Run tests: `cd backend && .venv/bin/pytest -q` (focused: `.venv/bin/pytest -q tests/test_x.py::test_y`)
- Frontend gates: `pnpm test`, `pnpm exec vue-tsc -b` (then `git checkout tsconfig.app.tsbuildinfo`)

### Files
- backend/requirements-dev.txt, backend/pytest.ini (pythonpath=., testpaths=tests)
- backend/tests/{__init__,conftest,factories,test_smoke}.py
- backend/.dockerignore; .gitignore (+`.pytest_cache/`, `backend/.venv`)

### Harness notes
- conftest sets DATABASE_URL=sqlite:// before importing app; per-test StaticPool in-memory engine; `db` and `client` fixtures; get_db overridden; TestClient used WITHOUT context manager (no lifespan/seed). Tables are empty per test.
- Factories take a Session: make_user/zone/merchant/courier/product(db, ...), auth_headers(user). PASSWORD_HASH is bcrypt of DEFAULT_PASSWORD ("Passw0rd!").
- Merchant/Courier/Product link by zone_slug / merchant_code strings (no FKs). Defaults: zone "zona-test", merchant "M-TEST".
- Known warning: Pydantic serializer warning on UserRead.role (str vs enum); pre-existing, harmless.

### TDD evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.3 | tests/test_smoke.py::test_health_ok | integration | n/a (no tests existed) | fail: `fixture 'client' not found` | pass | n/a (smoke) | none |
| 1.4/1.5 | test_smoke.py::test_login_with_factory_user, test_precomputed_hash_matches_default_password | integration/unit | n/a | (fixtures/factories absent) | pass | ok+bad password, hash right/wrong | none |
| 1.5 | test_smoke.py::test_no_goeats_db_created | integration | n/a | - | pass (file absent before and after) | existed-before == exists-after | none |

Note: 1.4 factories were written together with 1.5 tests in one step (strictly, tests then code ordering was for 1.3 only).

### Docker proof
`docker build -f backend/Dockerfile backend -t goeats-api-check` OK; `ls -a /app` = .dockerignore, Dockerfile, alembic, alembic.ini, app, requirements.txt. No .venv/tests/requirements-dev.txt/pytest.ini. Image removed.

### Remaining: PR2..PR10


## PR2 (tasks 2.1-2.4) - DONE, not committed
Branch: feat/customer-pr2-migration-link (stacked on PR1). Additive only: no status rewrite, no `rechazado`, no auth/orders/frontend/reports changes.

### Files
- NEW backend/app/core/migrations.py (`run_startup_migrations(engine)`: PG `pg_advisory_xact_lock(724001)`, inspector add-column inside a SAVEPOINT with duplicate-column catch, `CREATE UNIQUE INDEX IF NOT EXISTS`, email backfill only where NULL and user not already linked, INFO counts)
- NEW backend/app/shared/entity_links.py (`ENTITY_LINKS`; emails/codes verified against seed.py: identical to Q1, no fix needed)
- MOD merchants/models.py (`owner_user_id`), delivery/models.py (`user_id`): nullable, unique, indexed, FK users.id (ix_merchants_owner_user_id / ix_couriers_user_id)
- MOD main.py, init_db.py: create_all -> run_startup_migrations -> seed (reseed.py inherits via init())
- MOD seed.py: `_linked_user_id` sets links on fresh DB
- NEW tests/test_migrations.py (8 tests)

### TDD evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 2.1 | test_migrations.py::test_adds_columns_links_idempotent | integration (SQLite legacy DDL) | 5 PR1 tests green | collection error: no module app.core.migrations | pass | run twice; 8 links; c5/r5 unlinked; statuses untouched; plus backfill_leaves_existing_links_alone, unlinked_user_gets_no_link, info_log_counts | comment fix |
| 2.2 | test_entity_links_match_seed_emails | unit | - | fail (no entity_links) | pass | merchants + couriers | none |
| 2.3 | test_fresh_seed_links_entities, test_fresh_schema_noop, test_second_startup_is_noop_and_statuses_untouched | integration | - | fail (no columns/migration) | pass | fresh seed, fresh schema x2, second startup | none |
| 2.4 | test_seeded_users_have_consent_rows | integration | - | n/a (verifies existing behavior; green immediately) | pass | 25 users == 25 accepted consents | none |

Note: tests and implementation were written in one pass; RED was demonstrated by the collection error on the missing module for the whole file.

### 2.4 result
seed.py adds `DataConsent(accepted=True)` for every newly created user (all 25). Verified by test: 25 users, 25 accepted consents. Caveat: pre-existing users are not given consent rows (unchanged behavior).

### Real PostgreSQL verification (postgres:16-alpine, container goeats-pg-migcheck, port 55432, removed after; project containers/volume untouched)
- Legacy schema = create_all then DROP INDEX/COLUMN of the two link columns; 9 seed-email users, c1-c5, r1-r5.
- 4 concurrent processes on a wall-clock barrier: exactly one logged "merchants linked: 4 / couriers linked: 4", the other 3 logged 0; no errors.
- Asserted columns, unique indexes, FKs to users.id, 8 links correct, c5/r5 NULL.
- Two more sequential runs: no-op.
- Fresh DB: drop_all then `init()` twice: ok, links set for c1-c4 / r1-r4.
- NOT proven: V.1 against the EXISTING project volume (stays open).
- `docker build -f backend/Dockerfile backend -t goeats-api-check` OK, image removed.

### Gates
backend pytest 13 passed; `pnpm test` 273 passed; `pnpm exec vue-tsc -b` clean (tsbuildinfo restored).

### Remaining: PR3..PR10 (and V.1/V.2/V.3)
