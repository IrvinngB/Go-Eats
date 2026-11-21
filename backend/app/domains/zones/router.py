from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.domains.zones.schemas import ZoneRead
from app.domains.zones.service import ZoneService

router = APIRouter(prefix="/zones", tags=["zones"])


@router.get("/", response_model=list[ZoneRead])
def list_zones(db: Session = Depends(get_db)) -> list[ZoneRead]:
    return ZoneService(db).list_zones()


@router.get("/{slug}", response_model=ZoneRead)
def get_zone(slug: str, db: Session = Depends(get_db)) -> ZoneRead:
    return ZoneService(db).get_zone(slug)
