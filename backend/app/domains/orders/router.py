from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import CurrentUser, UserRole, get_current_user, require_roles
from app.domains.orders.schemas import (
    OrderAssignCourier,
    OrderCreate,
    OrderRatingCreate,
    OrderRead,
    OrderStatusUpdate,
)
from app.domains.orders.service import OrderService
from app.domains.users.dependencies import require_active_consent

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("/", response_model=list[OrderRead])
def list_orders(
    merchant_code: str | None = Query(default=None),
    courier_code: str | None = Query(default=None),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[OrderRead]:
    return OrderService(db).list_for(
        current_user, merchant_code=merchant_code, courier_code=courier_code
    )


@router.get("/{code}", response_model=OrderRead)
def get_order(
    code: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderRead:
    return OrderService(db).get_order_for(current_user, code)


@router.post("/", response_model=OrderRead, status_code=201)
def create_order(
    payload: OrderCreate,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(require_roles(UserRole.CUSTOMER)),
    _consent: CurrentUser = Depends(require_active_consent),
    db: Session = Depends(get_db),
) -> OrderRead:
    return OrderService(db).create_order(current_user.user_id, payload, background_tasks)


@router.patch("/{code}/status", response_model=OrderRead)
def update_order_status(
    code: str,
    payload: OrderStatusUpdate,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(
        require_roles(UserRole.MERCHANT, UserRole.COURIER, UserRole.ADMIN)
    ),
    db: Session = Depends(get_db),
) -> OrderRead:
    return OrderService(db).update_status(
        user=current_user,
        code=code,
        payload=payload,
        actor=f"{current_user.role}:{current_user.user_id}",
        background_tasks=background_tasks,
    )


@router.patch("/{code}/courier", response_model=OrderRead)
def assign_order_courier(
    code: str,
    payload: OrderAssignCourier,
    current_user: CurrentUser = Depends(require_roles(UserRole.MERCHANT, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> OrderRead:
    return OrderService(db).assign_courier(current_user, code, payload)


@router.post("/{code}/rating", response_model=OrderRead)
def rate_order(
    code: str,
    payload: OrderRatingCreate,
    current_user: CurrentUser = Depends(require_roles(UserRole.CUSTOMER)),
    db: Session = Depends(get_db),
) -> OrderRead:
    return OrderService(db).rate_order(current_user, code, payload)
