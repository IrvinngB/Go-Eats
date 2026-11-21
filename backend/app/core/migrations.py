"""Idempotent, additive startup migrations (no Alembic versions exist).

Adds the user -> entity link columns, their unique indexes, and backfills links by
email. Safe to run on every startup and from several workers at once.
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
