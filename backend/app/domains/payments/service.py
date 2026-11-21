from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.domains.payments.models import Payment
from app.domains.payments.providers import get_payment_provider
from app.domains.payments.repository import PaymentRepository
from app.domains.payments.schemas import PaymentCreate, PaymentStatusUpdate
from app.shared.audit import record_audit_event
from app.shared.storage import generate_receipt_pdf_bytes


class PaymentService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = PaymentRepository(db)

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

    def process_payment(self, payload: PaymentCreate) -> Payment:
        total = round(payload.subtotal + payload.delivery_fee, 2)
        provider = get_payment_provider(payload.method)
        gateway_result = provider.process(
            order_code=payload.order_code,
            amount=total,
            simulate_failure=payload.simulate_failure,
        )
        payment = self.repo.create(
            order_code=payload.order_code,
            merchant_name=payload.merchant_name,
            customer_name=payload.customer_name,
            method=payload.method,
            subtotal=payload.subtotal,
            delivery_fee=payload.delivery_fee,
            status=gateway_result.status,
            provider_reference=gateway_result.provider_reference,
            actor=payload.customer_name,
        )
        record_audit_event(self.db, payload.customer_name, gateway_result.message, "pago")
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

    def build_receipt_pdf(self, code: str) -> bytes:
        payment = self.get_payment(code)
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
