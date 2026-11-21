from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session
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

VALID_TRANSITIONS: dict[str, set[str]] = {
    "pendiente": {"confirmado", "rechazado", "cancelado"},
    "confirmado": {"en_preparacion", "en preparación", "rechazado", "cancelado"},
    "en_preparacion": {"listo_para_recoger", "listo para recoger", "cancelado"},
    "en preparación": {"listo_para_recoger", "listo para recoger", "cancelado"},
    "listo_para_recoger": {"en_camino", "en camino", "cancelado"},
    "listo para recoger": {"en_camino", "en camino", "cancelado"},
    "en_camino": {"entregado", "cancelado"},
    "en camino": {"entregado", "cancelado"},
    "entregado": set(),
    "cancelado": set(),
    "rechazado": set(),
}


class OrderService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = OrderRepository(db)
        self.courier_repo = CourierRepository(db)

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
        code: str,
        payload: OrderStatusUpdate,
        actor: str,
        background_tasks: BackgroundTasks,
    ) -> Order:
        order = self.get_order(code)
        allowed = VALID_TRANSITIONS.get(order.status, set())
        if payload.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid state transition from '{order.status}' to '{payload.status}'.",
            )
        if payload.status in {"cancelado", "rechazado"} and not (
            payload.reason and payload.reason.strip()
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cancellation or rejection requires a mandatory reason (RF-16).",
            )

        updated = self.repo.update_status(order, payload.status, actor=actor, reason=payload.reason)
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

    def assign_courier(self, code: str, payload: OrderAssignCourier) -> Order:
        order = self.get_order(code)
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

    def rate_order(self, code: str, payload: OrderRatingCreate) -> Order:
        order = self.get_order(code)
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
