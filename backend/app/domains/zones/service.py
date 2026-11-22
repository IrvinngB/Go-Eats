from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.domains.zones.models import Zone
from app.domains.zones.repository import ZoneRepository


class ZoneService:
    def __init__(self, db: Session) -> None:
        self.repo = ZoneRepository(db)

    def list_zones(self) -> list[Zone]:
        return self.repo.list_active()

    def get_zone(self, slug: str) -> Zone:
        zone = self.repo.get_by_slug(slug)
        if not zone:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found.")
        return zone
