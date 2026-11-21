from sqlalchemy import select
from sqlalchemy.orm import Session
from app.domains.payments.models import Payment, PaymentStatusHistory, Receipt


class PaymentRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_payments(
        self, status_filter: str | None = None, method_filter: str | None = None
    ) -> list[Payment]:
        stmt = select(Payment).order_by(Payment.id.desc())
        if status_filter:
            stmt = stmt.where(Payment.status == status_filter)
        if method_filter:
            stmt = stmt.where(Payment.method == method_filter)
        return list(self.db.scalars(stmt).all())

    def get_by_code(self, code: str) -> Payment | None:
        stmt = select(Payment).where(Payment.code == code)
        return self.db.scalars(stmt).first()

    def create(
        self,
        order_code: str,
        merchant_name: str,
        customer_name: str,
        method: str,
        subtotal: float,
        delivery_fee: float,
        status: str,
        provider_reference: str,
        actor: str,
    ) -> Payment:
        seq = len(self.list_payments()) + 9001
        code = f"TX-{seq}"
        commission = round(subtotal * 0.12, 2)
        total = round(subtotal + delivery_fee, 2)

        payment = Payment(
            code=code,
            order_code=order_code,
            merchant_name=merchant_name,
            customer_name=customer_name,
            method=method,
            subtotal=subtotal,
            delivery_fee=delivery_fee,
            commission=commission,
            total=total,
            status=status,
            provider_reference=provider_reference,
        )
        self.db.add(payment)
        self.db.flush()

        self.db.add(
            PaymentStatusHistory(
                payment_code=payment.code,
                previous_status=None,
                new_status=status,
                actor=actor,
            )
        )
        self.db.add(
            Receipt(
                receipt_number=f"REC-{seq}",
                payment_id=payment.id,
            )
        )
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def update_status(self, payment: Payment, new_status: str, actor: str) -> Payment:
        previous = payment.status
        payment.status = new_status
        self.db.add(
            PaymentStatusHistory(
                payment_code=payment.code,
                previous_status=previous,
                new_status=new_status,
                actor=actor,
            )
        )
        self.db.commit()
        self.db.refresh(payment)
        return payment
