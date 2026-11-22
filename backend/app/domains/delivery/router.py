from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import CurrentUser, UserRole, require_roles
from app.domains.delivery.schemas import (
    CourierAffiliationUpdate,
    CourierAvailabilityUpdate,
    CourierRead,
)
from app.domains.delivery.service import DeliveryService

router = APIRouter(prefix="/delivery", tags=["delivery"])


@router.get("/couriers", response_model=list[CourierRead])
def list_couriers(
    available: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[CourierRead]:
    return DeliveryService(db).list_couriers(only_available=available)


@router.get("/couriers/me", response_model=CourierRead)
def get_my_courier(
    current_user: CurrentUser = Depends(require_roles(UserRole.COURIER)),
    db: Session = Depends(get_db),
) -> CourierRead:
    return DeliveryService(db).get_mine(current_user.user_id)


@router.patch("/couriers/{code}/availability", response_model=CourierRead)
def update_courier_availability(
    code: str,
    payload: CourierAvailabilityUpdate,
    current_user: CurrentUser = Depends(require_roles(UserRole.COURIER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> CourierRead:
    return DeliveryService(db).update_availability(current_user, code, payload)


@router.patch("/couriers/{code}/affiliation", response_model=CourierRead)
def update_courier_affiliation(
    code: str,
    payload: CourierAffiliationUpdate,
    _: CurrentUser = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> CourierRead:
    return DeliveryService(db).update_affiliation(code, payload)
