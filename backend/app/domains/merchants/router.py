from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import CurrentUser, UserRole, require_roles
from app.domains.merchants.schemas import (
    MerchantAffiliationUpdate,
    MerchantRead,
    MerchantScheduleUpdate,
)
from app.domains.merchants.service import MerchantService

router = APIRouter(prefix="/merchants", tags=["merchants"])


@router.get("/", response_model=list[MerchantRead])
def list_merchants(
    zone: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[MerchantRead]:
    return MerchantService(db).list_merchants(zone_slug=zone)


@router.get("/mine", response_model=MerchantRead)
def get_my_merchant(
    current_user: CurrentUser = Depends(require_roles(UserRole.MERCHANT)),
    db: Session = Depends(get_db),
) -> MerchantRead:
    return MerchantService(db).get_mine(current_user.user_id)


@router.get("/{code}", response_model=MerchantRead)
def get_merchant(code: str, db: Session = Depends(get_db)) -> MerchantRead:
    return MerchantService(db).get_merchant(code)


@router.put("/{code}/schedule", response_model=MerchantRead)
def update_merchant_schedule(
    code: str,
    payload: MerchantScheduleUpdate,
    current_user: CurrentUser = Depends(require_roles(UserRole.MERCHANT, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> MerchantRead:
    return MerchantService(db).update_schedule(current_user, code, payload)


@router.patch("/{code}/affiliation", response_model=MerchantRead)
def update_merchant_affiliation(
    code: str,
    payload: MerchantAffiliationUpdate,
    _: CurrentUser = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> MerchantRead:
    return MerchantService(db).update_affiliation(code, payload)
