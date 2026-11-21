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
        conn.execute(text("INSERT INTO orders (code, status) VALUES ('PED-1', 'en preparación')"))
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


def _statuses(engine):
    with engine.connect() as conn:
        orders = [r[0] for r in conn.execute(text("SELECT status FROM orders ORDER BY id"))]
        history = [
            tuple(r)
            for r in conn.execute(
                text("SELECT previous_status, new_status FROM order_status_history ORDER BY id")
            )
        ]
    return orders, history


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

    # legacy statuses rewritten to canonical (PR5)
    assert _statuses(legacy_engine) == (["en_preparacion"], [("pendiente", "en_camino")])


NEW_COLUMNS = {
    "users": {"address", "lat", "lng"},
    "orders": {"delivery_lat", "delivery_lng"},
}


def _col_info(engine, table):
    return {c["name"]: c for c in inspect(engine).get_columns(table)}


def test_adds_address_columns_idempotent(legacy_engine):
    with legacy_engine.begin() as conn:
        conn.execute(text("INSERT INTO orders (code, status) VALUES ('PED-1', 'pendiente')"))
    for table, names in NEW_COLUMNS.items():
        assert not names & set(_col_info(legacy_engine, table))

    run_startup_migrations(legacy_engine)
    run_startup_migrations(legacy_engine)  # second run: no-op, no error

    for table, names in NEW_COLUMNS.items():
        info = _col_info(legacy_engine, table)
        for name in names:
            assert name in info
            assert info[name]["nullable"] is True
    with legacy_engine.connect() as conn:
        assert conn.execute(text("SELECT address, lat, lng FROM users")).all() == [(None, None, None)] * 9
        assert conn.execute(text("SELECT delivery_lat, delivery_lng FROM orders")).all() == [(None, None)] * 2


def test_address_columns_not_duplicated_on_partial_schema(legacy_engine):
    with legacy_engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN lat FLOAT"))
        conn.execute(text("UPDATE users SET lat = 8.5 WHERE id = 1"))
    run_startup_migrations(legacy_engine)
    with legacy_engine.connect() as conn:
        assert conn.execute(text("SELECT lat FROM users WHERE id = 1")).scalar_one() == 8.5
    assert {"address", "lat", "lng"} <= set(_col_info(legacy_engine, "users"))


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
    for table, names in NEW_COLUMNS.items():
        assert names <= set(_col_info(db_engine, table))
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


LEGACY_ORDERS = [
    ("PED-1", "en preparación"),
    ("PED-2", "listo para recoger"),
    ("PED-3", "en camino"),
    ("PED-4", "en camino"),
    ("PED-5", "entregado"),
    ("PED-6", "cancelado"),
]
LEGACY_HISTORY = [
    (None, "pendiente"),
    ("pendiente", "en preparación"),
    ("en preparación", "listo para recoger"),
    ("listo para recoger", "en camino"),
    ("en camino", "entregado"),
    ("pendiente", "cancelado"),
]


def _load_legacy_statuses(engine, orders=LEGACY_ORDERS, history=LEGACY_HISTORY):
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM orders"))
        conn.execute(text("DELETE FROM order_status_history"))
        for code, st in orders:
            conn.execute(text("INSERT INTO orders (code, status) VALUES (:c, :s)"), {"c": code, "s": st})
        for prev, new in history:
            conn.execute(
                text("INSERT INTO order_status_history (previous_status, new_status) VALUES (:p, :n)"),
                {"p": prev, "n": new},
            )


def test_status_rewrite_maps_orders_and_history(legacy_engine):
    _load_legacy_statuses(legacy_engine)
    run_startup_migrations(legacy_engine)
    orders, history = _statuses(legacy_engine)
    assert orders == ["en_preparacion", "listo_para_recoger", "en_camino", "en_camino", "entregado", "cancelado"]
    assert history == [
        (None, "pendiente"),
        ("pendiente", "en_preparacion"),
        ("en_preparacion", "listo_para_recoger"),
        ("listo_para_recoger", "en_camino"),
        ("en_camino", "entregado"),
        ("pendiente", "cancelado"),
    ]


def test_status_rewrite_second_run_is_noop(legacy_engine, caplog):
    _load_legacy_statuses(legacy_engine)
    run_startup_migrations(legacy_engine)
    after_first = _statuses(legacy_engine)
    with caplog.at_level(logging.INFO, logger="app.core.migrations"):
        run_startup_migrations(legacy_engine)
    assert _statuses(legacy_engine) == after_first
    assert "statuses rewritten: 0" in caplog.text


def test_status_rewrite_logs_counts(legacy_engine, caplog):
    _load_legacy_statuses(legacy_engine)
    with caplog.at_level(logging.INFO, logger="app.core.migrations"):
        run_startup_migrations(legacy_engine)
    # 4 legacy orders + 6 legacy history cells (prev+new)
    assert "statuses rewritten: 10" in caplog.text


def test_already_canonical_data_untouched(legacy_engine):
    canonical_orders = [("PED-1", "en_preparacion"), ("PED-2", "rechazado"), ("PED-3", "pendiente")]
    canonical_history = [(None, "pendiente"), ("pendiente", "rechazado"), ("confirmado", "en_preparacion")]
    _load_legacy_statuses(legacy_engine, canonical_orders, canonical_history)
    run_startup_migrations(legacy_engine)
    assert _statuses(legacy_engine) == (
        ["en_preparacion", "rechazado", "pendiente"],
        canonical_history,
    )


def test_status_rewrite_skipped_when_tables_missing():
    engine = _engine()
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(255))"))
    run_startup_migrations(engine)  # no orders/history tables: must not raise


def test_fresh_seed_is_canonical_and_has_rechazado(db, db_engine):
    seed_initial_data(db)
    db.commit()
    canonical = {
        "pendiente", "confirmado", "en_preparacion", "listo_para_recoger",
        "en_camino", "entregado", "rechazado", "cancelado",
    }
    with db_engine.connect() as conn:
        order_values = {r[0] for r in conn.execute(text("SELECT status FROM orders"))}
        hist_values = {
            v
            for row in conn.execute(text("SELECT previous_status, new_status FROM order_status_history"))
            for v in row
            if v is not None
        }
        rejected = conn.execute(
            text("SELECT code, cancellation_reason, courier_code FROM orders WHERE status='rechazado'")
        ).all()
        rejected_hist = conn.execute(
            text(
                "SELECT h.reason FROM order_status_history h JOIN orders o ON o.code=h.order_code "
                "WHERE o.status='rechazado' AND h.new_status='rechazado'"
            )
        ).all()
    assert order_values <= canonical and hist_values <= canonical
    assert "rechazado" in order_values
    assert len(rejected) >= 1 and all(r[1] and r[1].strip() for r in rejected)
    assert len(rejected_hist) == len(rejected) and all(r[0] for r in rejected_hist)


def test_fresh_seed_assigns_courier_to_in_delivery_states(db, db_engine):
    seed_initial_data(db)
    db.commit()
    with db_engine.connect() as conn:
        with_courier = {
            r[0]
            for r in conn.execute(text("SELECT DISTINCT status FROM orders WHERE courier_code IS NOT NULL"))
        }
        without = {
            r[0]
            for r in conn.execute(text("SELECT DISTINCT status FROM orders WHERE courier_code IS NULL"))
        }
    assert with_courier == {"listo_para_recoger", "en_camino", "entregado"}
    assert without.isdisjoint(with_courier)


def test_seed_on_existing_db_does_not_add_rechazado(db, db_engine):
    seed_initial_data(db)
    db.commit()
    with db_engine.begin() as conn:
        conn.execute(text("DELETE FROM orders WHERE status='rechazado'"))
        conn.execute(text("DELETE FROM order_status_history WHERE new_status='rechazado'"))
    run_startup_migrations(db_engine)
    seed_initial_data(db)  # >=40 orders: skipped, documented
    db.commit()
    with db_engine.connect() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM orders WHERE status='rechazado'")).scalar_one() == 0
