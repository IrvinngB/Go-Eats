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
