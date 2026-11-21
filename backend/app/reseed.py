"""Reset the database and reload the demo dataset with timestamps relative to NOW.

Usage (inside the running stack):
    docker compose exec api python -m app.reseed
"""
from app.core.database import Base, SessionLocal, engine
from app.init_db import init


def reseed() -> None:
    Base.metadata.drop_all(bind=engine)
    init()
    with SessionLocal() as db:
        from sqlalchemy import func, select

        from app.domains.orders.models import Order

        total = db.scalar(select(func.count(Order.id))) or 0
    print(f"Reseed complete: {total} orders with fresh timestamps.")


if __name__ == "__main__":
    reseed()
