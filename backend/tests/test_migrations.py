import logging

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.core.migrations import run_startup_migrations
from app.domains.delivery.models import Courier
from app.domains.merchants.models import Merchant
from app.domains.orders.models import Order, OrderStatusHistory
from app.domains.users.models import DataConsent, User
from app.seed import seed_initial_data
from app.shared.entity_links import ENTITY_LINKS

LEGACY_DDL = [
    """CREATE TABLE users (
        id INTEGER PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE)""",
    """CREATE TABLE merchants (
        id INTEGER PRIMARY KEY, code VARCHAR(40) NOT NULL UNIQUE)""",
    """CREATE TABLE couriers (
        id INTEGER PRIMARY KEY, code VARCHAR(40) NOT NULL UNIQUE)""",
    """CREATE TABLE orders (
        id INTEGER PRIMARY KEY, code VARCHAR(40) NOT NULL, status VARCHAR(30) NOT NULL)""",
    """CREATE TABLE order_status_history (
        id INTEGER PRIMARY KEY, previous_status VARCHAR(30), new_status VARCHAR(30))""",
]

MERCHANT_EMAILS = {
    "hector.endara@ejemplo.pa": "c1",
    "patricia.motta@ejemplo.pa": "c2",
    "arturo.melo@ejemplo.pa": "c3",
    "monica.aleman@ejemplo.pa": "c4",
}
COURIER_EMAILS = {
    "javier.morales@ejemplo.pa": "r1",
    "maria.cedeno@ejemplo.pa": "r2",
    "luis.gomez@ejemplo.pa": "r3",
    "pedro.abrego@ejemplo.pa": "r4",
}


def _engine():
    return create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )


@pytest.fixture()
def legacy_engine():
    engine = _engine()
    with engine.begin() as conn:
        for ddl in LEGACY_DDL:
            conn.execute(text(ddl))
        for i, email in enumerate([*MERCHANT_EMAILS, *COURIER_EMAILS, "carlos@ejemplo.pa"], 1):
            conn.execute(text("INSERT INTO users (id, email) VALUES (:i, :e)"), {"i": i, "e": email})
        for code in [*MERCHANT_EMAILS.values(), "c5"]:
            conn.execute(text("INSERT INTO merchants (code) VALUES (:c)"), {"c": code})
        for code in [*COURIER_EMAILS.values(), "r5"]:
            conn.execute(text("INSERT INTO couriers (code) VALUES (:c)"), {"c": code})
        conn.execute(text("INSERT INTO orders (code, status) VALUES ('PED-1', 'en preparacion')"))
        conn.execute(
            text(
                "INSERT INTO order_status_history (previous_status, new_status) "
                "VALUES ('pendiente', 'en camino')"
            )
        )
    yield engine
    engine.dispose()


def _links(engine, table, col):
    with engine.connect() as conn:
        rows = conn.execute(text(f"SELECT code, {col} FROM {table} ORDER BY id")).all()
        emails = dict(conn.execute(text("SELECT id, email FROM users")).all())
    return {code: emails.get(uid) for code, uid in rows}


def _unique_index_names(engine, table):
    return {i["name"] for i in inspect(engine).get_indexes(table) if i["unique"]}


def test_adds_columns_links_idempotent(legacy_engine):
    run_startup_migrations(legacy_engine)

    insp = inspect(legacy_engine)
    assert "owner_user_id" in {c["name"] for c in insp.get_columns("merchants")}
    assert "user_id" in {c["name"] for c in insp.get_columns("couriers")}
    assert "ix_merchants_owner_user_id" in _unique_index_names(legacy_engine, "merchants")
    assert "ix_couriers_user_id" in _unique_index_names(legacy_engine, "couriers")
    fk = insp.get_foreign_keys("merchants")[0]
    assert (fk["referred_table"], fk["constrained_columns"]) == ("users", ["owner_user_id"])

    merchants = _links(legacy_engine, "merchants", "owner_user_id")
    couriers = _links(legacy_engine, "couriers", "user_id")
    assert merchants == {**{c: e for e, c in MERCHANT_EMAILS.items()}, "c5": None}
    assert couriers == {**{c: e for e, c in COURIER_EMAILS.items()}, "r5": None}

    # second run: no-op, same state
    run_startup_migrations(legacy_engine)
    assert _links(legacy_engine, "merchants", "owner_user_id") == merchants
    assert _links(legacy_engine, "couriers", "user_id") == couriers

    # statuses untouched (additive only)
    with legacy_engine.connect() as conn:
        assert conn.execute(text("SELECT status FROM orders")).scalar_one() == "en preparacion"
        assert conn.execute(
            text("SELECT previous_status, new_status FROM order_status_history")
        ).one() == ("pendiente", "en camino")


def test_backfill_leaves_existing_links_alone(legacy_engine):
    run_startup_migrations(legacy_engine)
    with legacy_engine.begin() as conn:
        carlos = conn.execute(text("SELECT id FROM users WHERE email='carlos@ejemplo.pa'")).scalar_one()
        conn.execute(text("UPDATE merchants SET owner_user_id=:u WHERE code='c1'"), {"u": carlos})
        conn.execute(text("UPDATE merchants SET owner_user_id=NULL WHERE code='c2'"))
    run_startup_migrations(legacy_engine)
    links = _links(legacy_engine, "merchants", "owner_user_id")
    assert links["c1"] == "carlos@ejemplo.pa"  # non-NULL link preserved
    assert links["c2"] == "patricia.motta@ejemplo.pa"  # NULL link refilled


def test_unlinked_user_gets_no_link():
    engine = _engine()
    with engine.begin() as conn:
        for ddl in LEGACY_DDL:
            conn.execute(text(ddl))
        conn.execute(text("INSERT INTO users (id, email) VALUES (1, 'otro@ejemplo.pa')"))
        conn.execute(text("INSERT INTO merchants (code) VALUES ('c1')"))
        conn.execute(text("INSERT INTO couriers (code) VALUES ('r1')"))
    run_startup_migrations(engine)
    assert _links(engine, "merchants", "owner_user_id") == {"c1": None}
    assert _links(engine, "couriers", "user_id") == {"r1": None}


def test_info_log_counts(legacy_engine, caplog):
    with caplog.at_level(logging.INFO, logger="app.core.migrations"):
        run_startup_migrations(legacy_engine)
    assert "merchants linked: 4" in caplog.text
    assert "couriers linked: 4" in caplog.text


def test_fresh_schema_noop(db_engine):
    before = {t: {c["name"] for c in inspect(db_engine).get_columns(t)} for t in ("merchants", "couriers")}
    run_startup_migrations(db_engine)
    run_startup_migrations(db_engine)
    after = {t: {c["name"] for c in inspect(db_engine).get_columns(t)} for t in ("merchants", "couriers")}
    assert before == after
    assert "owner_user_id" in after["merchants"] and "user_id" in after["couriers"]
    assert "ix_merchants_owner_user_id" in _unique_index_names(db_engine, "merchants")


def test_entity_links_match_seed_emails():
    assert ENTITY_LINKS["merchants"] == MERCHANT_EMAILS
    assert ENTITY_LINKS["couriers"] == COURIER_EMAILS


def test_fresh_seed_links_entities(db, db_engine):
    seed_initial_data(db)
    db.commit()
    links = _links(db_engine, "merchants", "owner_user_id")
    assert {c: links[c] for c in ("c1", "c2", "c3", "c4")} == {c: e for e, c in MERCHANT_EMAILS.items()}
    assert links["c5"] is None
    clinks = _links(db_engine, "couriers", "user_id")
    assert {c: clinks[c] for c in ("r1", "r2", "r3", "r4")} == {c: e for e, c in COURIER_EMAILS.items()}
    assert clinks["r5"] is None


def test_second_startup_is_noop_and_statuses_untouched(db, db_engine):
    seed_initial_data(db)
    db.commit()
    run_startup_migrations(db_engine)
    snap = (
        _links(db_engine, "merchants", "owner_user_id"),
        _links(db_engine, "couriers", "user_id"),
    )
    with db_engine.connect() as conn:
        statuses = conn.execute(text("SELECT status, COUNT(*) FROM orders GROUP BY status")).all()
    run_startup_migrations(db_engine)
    seed_initial_data(db)  # skipped: >=40 orders
    db.commit()
    assert snap == (
        _links(db_engine, "merchants", "owner_user_id"),
        _links(db_engine, "couriers", "user_id"),
    )
    with db_engine.connect() as conn:
        assert statuses == conn.execute(text("SELECT status, COUNT(*) FROM orders GROUP BY status")).all()


def test_seeded_users_have_consent_rows(db):
    seed_initial_data(db)
    db.commit()
    users = db.query(User).count()
    consented = db.query(DataConsent).filter(DataConsent.accepted.is_(True)).count()
    assert users == 25
    assert consented == users
