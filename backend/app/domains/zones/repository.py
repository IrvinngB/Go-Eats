from sqlalchemy import select
from sqlalchemy.orm import Session
from app.domains.zones.models import Zone


class ZoneRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_active(self) -> list[Zone]:
        stmt = select(Zone).where(Zone.is_active.is_(True)).order_by(Zone.id.asc())
        return list(self.db.scalars(stmt).all())

    def get_by_slug(self, slug: str) -> Zone | None:
        stmt = select(Zone).where(Zone.slug == slug)
        return self.db.scalars(stmt).first()

    def create(self, slug: str, name: str, delivery_fee: float, distance_km: float) -> Zone:
        zone = Zone(slug=slug, name=name, delivery_fee=delivery_fee, distance_km=distance_km)
        self.db.add(zone)
        self.db.commit()
        self.db.refresh(zone)
        return zone
