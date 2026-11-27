"""Idempotent, additive startup migrations (no Alembic versions exist).

Adds the user -> entity link columns, their unique indexes, backfills links by email and
rewrites legacy spaced order statuses to the canonical underscore spelling. Safe to run
on every startup and from several workers at once.
"""

import logging

from sqlalchemy import Connection, Engine, inspect, text
from sqlalchemy.exc import OperationalError, ProgrammingError

from app.shared.entity_links import ENTITY_LINKS

logger = logging.getLogger(__name__)

ADVISORY_LOCK_ID = 724001

# table -> (column, index name); table name is also the ENTITY_LINKS key
_LINKS = {
    "merchants": ("owner_user_id", "ix_merchants_owner_user_id"),
    "couriers": ("user_id", "ix_couriers_user_id"),
}


# Legacy (spaced, accented) -> canonical. Order of keys is irrelevant: no target is a source.
LEGACY_STATUS_MAP = {
    "en preparación": "en_preparacion",
    "listo para recoger": "listo_para_recoger",
    "en camino": "en_camino",
}

# table -> status columns holding order states
_STATUS_COLUMNS = {
    "orders": ("status",),
    "order_status_history": ("previous_status", "new_status"),
}


def _add_column(conn: Connection, table: str, column: str) -> None:
    columns = {c["name"] for c in inspect(conn).get_columns(table)}
    if column in columns:
        return
    try:
        with conn.begin_nested():  # savepoint: a failed DDL must not abort the outer tx on PG
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} INTEGER REFERENCES users(id)"))
    except (ProgrammingError, OperationalError) as exc:
        if "duplicate column" in str(exc).lower() or "already exists" in str(exc).lower():
            logger.warning("column %s.%s already added by another worker", table, column)
            return
        raise


# table -> [(column, SQL type)]: nullable plain columns for the delivery address feature
_PLAIN_COLUMNS = {
    "users": [("address", "TEXT"), ("lat", "FLOAT"), ("lng", "FLOAT")],
    "orders": [
        ("delivery_lat", "FLOAT"),
        ("delivery_lng", "FLOAT"),
        ("idempotency_key", "VARCHAR(64)"),
    ],
}

# Unique indexes over plain columns, created once their columns exist.
_PLAIN_INDEXES = {
    "orders": [("ix_orders_customer_idempotency", ("customer_id", "idempotency_key"))],
}


def _add_plain_column(conn: Connection, table: str, column: str, sqltype: str) -> None:
    """Add a nullable column without constraints; idempotent and tolerant of concurrent adds."""
    columns = {c["name"] for c in inspect(conn).get_columns(table)}
    if column in columns:
        return
    try:
        with conn.begin_nested():
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sqltype}"))
    except (ProgrammingError, OperationalError) as exc:
        if "duplicate column" in str(exc).lower() or "already exists" in str(exc).lower():
            logger.warning("column %s.%s already added by another worker", table, column)
            return
        raise


def _backfill(conn: Connection, table: str, column: str, links: dict[str, str]) -> int:
    linked = 0
    for email, code in links.items():
        user_id = conn.execute(text("SELECT id FROM users WHERE email = :e"), {"e": email}).scalar()
        if user_id is None:
            continue
        taken = conn.execute(
            text(f"SELECT 1 FROM {table} WHERE {column} = :u"), {"u": user_id}
        ).first()
        if taken:
            continue
        result = conn.execute(
            text(f"UPDATE {table} SET {column} = :u WHERE code = :c AND {column} IS NULL"),
            {"u": user_id, "c": code},
        )
        linked += result.rowcount or 0
    return linked


def _rewrite_statuses(conn: Connection, tables: set[str]) -> int:
    """Rewrite legacy status strings. A plain UPDATE ... WHERE col = legacy is naturally
    idempotent (a second run matches nothing) and safe under the advisory lock."""
    inspector = inspect(conn)
    rewritten = 0
    for table, columns in _STATUS_COLUMNS.items():
        if table not in tables:
            continue
        present = {c["name"] for c in inspector.get_columns(table)}
        for column in columns:
            if column not in present:
                continue
            for legacy, canonical in LEGACY_STATUS_MAP.items():
                result = conn.execute(
                    text(f"UPDATE {table} SET {column} = :new WHERE {column} = :old"),
                    {"new": canonical, "old": legacy},
                )
                rewritten += result.rowcount or 0
    return rewritten


def run_startup_migrations(engine: Engine) -> None:
    with engine.begin() as conn:
        if conn.dialect.name == "postgresql":
            conn.execute(text("SELECT pg_advisory_xact_lock(:id)"), {"id": ADVISORY_LOCK_ID})
        tables = set(inspect(conn).get_table_names())
        if "users" not in tables:
            return
        for table, (column, index_name) in _LINKS.items():
            if table not in tables:
                continue
            _add_column(conn, table, column)
            conn.execute(
                text(f"CREATE UNIQUE INDEX IF NOT EXISTS {index_name} ON {table} ({column})")
            )
            linked = _backfill(conn, table, column, ENTITY_LINKS[table])
            logger.info("migration: %s linked: %d", table, linked)
        for table, specs in _PLAIN_COLUMNS.items():
            if table not in tables:
                continue
            for column, sqltype in specs:
                _add_plain_column(conn, table, column, sqltype)
        for table, indexes in _PLAIN_INDEXES.items():
            if table not in tables:
                continue
            present = {c["name"] for c in inspect(conn).get_columns(table)}
            for index_name, columns in indexes:
                if not set(columns) <= present:  # partial legacy schema: nothing to index yet
                    continue
                conn.execute(
                    text(
                        f"CREATE UNIQUE INDEX IF NOT EXISTS {index_name} "
                        f"ON {table} ({', '.join(columns)})"
                    )
                )
        logger.info("migration: statuses rewritten: %d", _rewrite_statuses(conn, tables))
