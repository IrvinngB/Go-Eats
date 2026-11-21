# Backend Testing Specification

## Purpose
Provide a hermetic, repeatable pytest harness for the backend so security and pricing fixes can be built test-first. Today the backend has no test runner and no tests directory.

## Requirements

### Requirement: Runnable test suite
The system MUST provide a dev dependency manifest (`requirements-dev.txt`) that installs pytest, and a test suite under `backend/tests/` that runs with a bare `pytest` invocation from `backend/`.

#### Scenario: Run from backend directory
- GIVEN a clean virtualenv with `requirements.txt` and `requirements-dev.txt` installed
- WHEN `pytest` is run from `backend/`
- THEN the suite is discovered and executes without extra flags or environment variables
- AND the process exits 0 when all tests pass and non-zero when any fails

#### Scenario: Smoke test exists
- GIVEN the harness is installed
- WHEN the suite is run
- THEN at least one test exercises the app through the HTTP client and passes

### Requirement: Isolated in-memory database
Tests MUST run against an in-memory SQLite database injected by overriding the application's `get_db` dependency, and MUST NOT touch the configured development or production database.

#### Scenario: Per-test isolation
- GIVEN test A creates a user
- WHEN test B starts
- THEN test B sees an empty database (schema created, no rows from test A)

#### Scenario: Dev database untouched
- GIVEN a `goeats.db` file exists or `DATABASE_URL` points to another database
- WHEN the suite runs
- THEN no rows are read from or written to that database

The harness MUST NOT run the real application lifespan (no `TestClient` context manager on the real app, so no real create_all, seed or startup migration against the configured database) and MUST use SQLite in-memory with `StaticPool` and `check_same_thread=False` so every connection sees the same database.

#### Scenario: Lifespan not run
- GIVEN the client fixture is used
- WHEN a test runs
- THEN the real lifespan is not executed and `goeats.db` is neither created nor modified

#### Scenario: Shared in-memory connection
- GIVEN a test creates rows in one session
- WHEN a request handled by another session reads them
- THEN the rows are visible

### Requirement: HTTP client fixture
The harness MUST expose a FastAPI TestClient fixture bound to the app with the overridden database, so tests exercise real routing, auth dependencies, and serialization.

#### Scenario: Auth dependency is real
- GIVEN the client fixture
- WHEN a request is sent to a protected route without a token
- THEN the response is 401 from the real auth dependency (not bypassed)

### Requirement: User and token factory
The harness MUST provide factories that create a persisted user with a given role (customer, merchant, courier, accountant, admin) and return valid access and refresh tokens built with the application's own security module.

#### Scenario: Role-specific token
- GIVEN the factory is asked for a `merchant` user
- WHEN the returned access token is sent as a Bearer header
- THEN the API identifies the caller as that user with role `merchant`

#### Scenario: Password login works for factory users
- GIVEN a factory user created with a known password
- WHEN `POST /auth/login` is called with those credentials
- THEN a token response is returned

### Requirement: Domain data factories
The harness SHOULD provide helpers to create the minimum domain data needed by tests: zone with tariff, merchant, product (available and unavailable), courier, and order.

#### Scenario: Seed a purchasable catalog
- GIVEN helpers for zone, merchant and product
- WHEN a test builds one of each
- THEN a customer order can be created against them through the API

### Requirement: Hermetic and CI-friendly
Tests MUST NOT require network access, Docker, Postgres, MinIO/S3, or real push services, and MUST be deterministic with respect to ordering. External side effects (push notification, object storage) MUST be inert or stubbed under test.

#### Scenario: Offline execution
- GIVEN no network connectivity and no services running
- WHEN the suite runs
- THEN all tests pass

#### Scenario: Random order
- GIVEN the suite is run twice in different orders
- WHEN results are compared
- THEN pass/fail results are identical

### Requirement: Dev-flag control in tests
Tests MUST toggle `dev_role_override` and `dev_simulate_failure` with `monkeypatch.setattr(settings, ...)` for that test only; defaults are off and MUST be restored automatically.

#### Scenario: Flag restored
- GIVEN a test enables a dev flag via monkeypatch
- WHEN the test ends
- THEN the next test observes the flag off

### Requirement: Startup migration tests
The suite MUST include a test that `run_startup_migrations` upgrades a pre-change schema (old tables created without link columns, legacy statuses) and is idempotent, plus a test that a second startup run is a no-op. These tests MUST use their own in-memory engine.

#### Scenario: Idempotency
- GIVEN old-schema tables with legacy statuses
- WHEN the migration runs twice
- THEN the result after the second run equals the result after the first

#### Scenario: Second startup no-op
- GIVEN a migrated database
- WHEN the migration runs again
- THEN no rows or schema objects change

### Requirement: Documented SQLite/Postgres gap
New backend code under this change SHOULD avoid Postgres-only column types or SQL so that it behaves the same on SQLite; any known divergence MUST be documented.

#### Scenario: Documentation present
- GIVEN the harness is delivered
- WHEN a developer reads the backend testing notes
- THEN the SQLite-vs-Postgres limitation and how to run the suite are described
