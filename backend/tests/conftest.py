import os

# Must run BEFORE any `app` import: the engine is built at import time.
os.environ["DATABASE_URL"] = "sqlite://"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.init_db  # noqa: E402,F401  (registers every model on Base.metadata)
from app.core.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    # Rate-limit counters are process-global: never let one test's hits leak into the next.
    from app.core.rate_limit import limiter

    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture()
def db_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture()
def db(db_engine):
    session = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_engine):
    factory = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

    def override_get_db():
        session = factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    # No context manager: the real lifespan (create_all + seed) must not run.
    yield TestClient(app)
    app.dependency_overrides.clear()
