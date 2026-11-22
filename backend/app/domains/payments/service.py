from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.rbac import CurrentUser, UserRole
from app.domains.orders.models import Order
from app.domains.orders.repository import OrderRepository
from app.domains.payments.models import Payment
from app.domains.payments.providers import get_payment_provider
from app.domains.payments.repository import PaymentRepository
from app.domains.payments.schemas import PaymentCreate, PaymentStatusUpdate
from app.shared.audit import record_audit_event
from app.shared.storage import generate_receipt_pdf_bytes


PAYMENT_FAILED_REASON = "Pago electrónico rechazado"


class PaymentService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = PaymentRepository(db)
        self.order_repo = OrderRepository(db)

    def list_payments(
        self, status_filter: str | None = None, method_filter: str | None = None
    ) -> list[Payment]:
        return self.repo.list_payments(status_filter=status_filter, method_filter=method_filter)

    def get_payment(self, code: str) -> Payment:
        payment = self.repo.get_by_code(code)
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Payment transaction not found."
            )
        return payment

    def _own_order(self, user: CurrentUser, order_code: str) -> Order:
        order = self.order_repo.get_by_code(order_code)
        if not order or order.customer_id != user.user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
        return order

    def process_payment(self, user: CurrentUser, payload: PaymentCreate) -> Payment:
        order = self._own_order(user, payload.order_code)
        if order.status != "pendiente":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only pending orders can be paid.",
            )
        if payload.method != order.payment_method:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment method does not match the order's method.",
            )
        if self.repo.has_active_payment(order.code):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This order already has an active payment.",
            )
        # Failure simulation is a server-side dev switch; the request alone can never enable it.
        simulate_failure = payload.simulate_failure and settings.dev_simulate_failure
        gateway_result = get_payment_provider(payload.method).process(
            order_code=order.code,
            amount=order.total,
            simulate_failure=simulate_failure,
        )
        payment = self.repo.create(
            order_code=order.code,
            merchant_name=order.merchant_name,
            customer_name=order.customer_name,
            method=payload.method,
            subtotal=order.subtotal,
            delivery_fee=order.delivery_fee,
            status=gateway_result.status,
            provider_reference=gateway_result.provider_reference,
            actor=f"{user.role}:{user.user_id}",
        )
        record_audit_event(self.db, order.customer_name, gateway_result.message, "pago")
        if gateway_result.status == "fallido":
            self.order_repo.update_status(
                order, "cancelado", actor="sistema:pago", reason=PAYMENT_FAILED_REASON
            )
            record_audit_event(
                self.db,
                "sistema:pago",
                f"Pedido {order.code} cancelado por pago rechazado",
                "pedido",
            )
        return payment

    def reconcile_payment(self, code: str, payload: PaymentStatusUpdate, actor: str) -> Payment:
        payment = self.get_payment(code)
        updated = self.repo.update_status(payment, payload.status, actor=actor)
        record_audit_event(
            self.db,
            actor,
            f"Transacción {updated.code} conciliada como '{updated.status}'",
            "pago",
        )
        return updated

    def build_receipt_pdf(self, user: CurrentUser, code: str) -> bytes:
        payment = self.get_payment(code)
        if user.role == UserRole.CUSTOMER:
            self._own_order(user, payment.order_code)  # another customer's receipt: 404
        return generate_receipt_pdf_bytes(
            receipt_number=f"REC-{payment.code}",
            order_code=payment.order_code,
            merchant_name=payment.merchant_name,
            customer_name=payment.customer_name,
            payment_method=payment.method,
            subtotal=payment.subtotal,
            delivery_fee=payment.delivery_fee,
            total=payment.total,
            issued_at=payment.created_at.strftime("%Y-%m-%d %H:%M UTC"),
        )
