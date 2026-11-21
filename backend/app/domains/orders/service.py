import logging

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session
from app.core.rbac import CurrentUser, UserRole
from app.domains.merchants.repository import MerchantRepository
from app.domains.delivery.repository import CourierRepository
from app.domains.orders.models import Order
from app.domains.orders.repository import OrderRepository
from app.domains.orders.schemas import (
    OrderAssignCourier,
    OrderCreate,
    OrderRatingCreate,
    OrderStatusUpdate,
)
from app.shared.audit import record_audit_event
from app.shared.push import send_push_notification

logger = logging.getLogger(__name__)

TERMINAL_STATES = frozenset({"entregado", "rechazado", "cancelado"})
REASON_REQUIRED = frozenset({"rechazado", "cancelado"})

# Section 3.3: forward chain plus rechazado/cancelado from any non-terminal state.
VALID_TRANSITIONS: dict[str, set[str]] = {
    "pendiente": {"confirmado", "rechazado", "cancelado"},
    "confirmado": {"en_preparacion", "rechazado", "cancelado"},
    "en_preparacion": {"listo_para_recoger", "rechazado", "cancelado"},
    "listo_para_recoger": {"en_camino", "rechazado", "cancelado"},
    "en_camino": {"entregado", "rechazado", "cancelado"},
    "entregado": set(),
    "rechazado": set(),
    "cancelado": set(),
}

# Which targets each role may set (customer and accountant never reach the service).
ROLE_TARGETS: dict[UserRole, frozenset[str]] = {
    UserRole.MERCHANT: frozenset(
        {"confirmado", "en_preparacion", "listo_para_recoger", "rechazado", "cancelado"}
    ),
    UserRole.COURIER: frozenset({"en_camino", "entregado", "cancelado"}),
}


class OrderService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = OrderRepository(db)
        self.courier_repo = CourierRepository(db)
        self.merchant_repo = MerchantRepository(db)

    def list_orders(
        self,
        customer_id: int | None = None,
        merchant_code: str | None = None,
        courier_code: str | None = None,
    ) -> list[Order]:
        return self.repo.list_orders(
            customer_id=customer_id,
            merchant_code=merchant_code,
            courier_code=courier_code,
        )

    def list_for(
        self,
        user: CurrentUser,
        merchant_code: str | None = None,
        courier_code: str | None = None,
    ) -> list[Order]:
        """Role-scoped listing. Query filters can only narrow the caller's scope (AND)."""
        scope: dict = {}
        if user.role == UserRole.CUSTOMER:
            scope["customer_id"] = user.user_id
        elif user.role == UserRole.MERCHANT:
            merchant = self.merchant_repo.get_by_owner(user.user_id)
            if not merchant:
                return []
            scope["merchant_code"] = merchant.code
        elif user.role == UserRole.COURIER:
            courier = self.courier_repo.get_by_user(user.user_id)
            if not courier:
                return []
            scope["courier_code"] = courier.code
        elif user.role not in (UserRole.ADMIN, UserRole.ACCOUNTANT):
            return []
        for key, value in (("merchant_code", merchant_code), ("courier_code", courier_code)):
            if value is None:
                continue
            if key in scope and scope[key] != value:
                return []
            scope[key] = value
        return self.repo.list_orders(**scope)

    def _in_scope(self, user: CurrentUser, order: Order) -> bool:
        if user.role in (UserRole.ADMIN, UserRole.ACCOUNTANT):
            return True
        if user.role == UserRole.CUSTOMER:
            return order.customer_id == user.user_id
        if user.role == UserRole.MERCHANT:
            merchant = self.merchant_repo.get_by_owner(user.user_id)
            return merchant is not None and order.merchant_code == merchant.code
        if user.role == UserRole.COURIER:
            courier = self.courier_repo.get_by_user(user.user_id)
            return courier is not None and order.courier_code == courier.code
        return False

    def get_order_for(self, user: CurrentUser, code: str) -> Order:
        order = self.get_order(code)
        if not self._in_scope(user, order):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
        return order

    def get_order(self, code: str) -> Order:
        order = self.repo.get_by_code(code)
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
        return order

    def create_order(
        self, customer_id: int, payload: OrderCreate, background_tasks: BackgroundTasks
    ) -> Order:
        order = self.repo.create(customer_id=customer_id, payload=payload, actor=payload.customer_name)
        record_audit_event(
            self.db,
            payload.customer_name,
            f"Creó pedido {order.code} en {order.merchant_name} por B/ {order.total:.2f}",
            "pedido",
        )
        background_tasks.add_task(
            send_push_notification,
            customer_id,
            f"Pedido {order.code} recibido",
            f"Tu pedido en {order.merchant_name} fue registrado.",
        )
        return order

    def update_status(
        self,
        user: CurrentUser,
        code: str,
        payload: OrderStatusUpdate,
        actor: str,
        background_tasks: BackgroundTasks,
    ) -> Order:
        order = self.get_order_for(user, code)  # 404 outside the caller's scope
        allowed_targets = ROLE_TARGETS.get(user.role)
        if allowed_targets is not None and payload.status not in allowed_targets:
            logger.warning(
                "status target forbidden: user=%s role=%s order=%s target=%s",
                user.user_id,
                user.role,
                code,
                payload.status,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' cannot set status '{payload.status}'.",
            )
        if payload.status not in VALID_TRANSITIONS.get(order.status, set()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid state transition from '{order.status}' to '{payload.status}'.",
            )
        reason = payload.reason.strip() if payload.reason else None
        if payload.status in REASON_REQUIRED and not reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cancellation or rejection requires a mandatory reason (RF-16).",
            )

        updated = self.repo.update_status(order, payload.status, actor=actor, reason=reason)
        record_audit_event(
            self.db,
            actor,
            f"Pedido {updated.code} pasó a '{updated.status}'",
            "pedido",
        )
        background_tasks.add_task(
            send_push_notification,
            updated.customer_id,
            f"Actualización de pedido {updated.code}",
            f"Nuevo estado: {updated.status}",
        )
        return updated

    def assign_courier(self, user: CurrentUser, code: str, payload: OrderAssignCourier) -> Order:
        order = self.get_order_for(user, code)  # merchant: only its own orders; admin: any
        courier = self.courier_repo.get_by_code(payload.courier_code)
        if not courier or not courier.is_available or courier.affiliation_status != "activo":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected courier is not available or active (RF-01).",
            )
        updated = self.repo.assign_courier(order, courier.code)
        record_audit_event(
            self.db,
            order.merchant_name,
            f"Asignó repartidor {courier.name} al pedido {updated.code}",
            "pedido",
        )
        return updated

    def rate_order(self, user: CurrentUser, code: str, payload: OrderRatingCreate) -> Order:
        order = self.get_order_for(user, code)  # only the owning customer reaches here
        if order.status != "entregado":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only delivered orders can be rated (RF-20).",
            )
        updated = self.repo.save_rating(order, payload)
        record_audit_event(
            self.db,
            order.customer_name,
            f"Calificó pedido {order.code} (Comercio: {payload.merchant_stars}/5, Repartidor: {payload.courier_stars}/5)",
            "pedido",
        )
        return updated
