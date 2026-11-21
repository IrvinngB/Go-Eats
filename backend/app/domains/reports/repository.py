from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.domains.merchants.models import Merchant
from app.domains.orders.models import Order
from app.domains.payments.models import Payment
from app.shared.audit import AuditLog


class ReportRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def count_orders(self) -> int:
        return self.db.scalar(select(func.count(Order.id))) or 0

    def sum_revenue(self) -> float:
        val = self.db.scalar(
            select(func.sum(Order.total)).where(Order.status != "cancelado")
        )
        return round(float(val or 0.0), 2)

    def count_active_merchants(self) -> int:
        return (
            self.db.scalar(
                select(func.count(Merchant.id)).where(
                    Merchant.affiliation_status == "activo", Merchant.is_open.is_(True)
                )
            )
            or 0
        )

    def list_payments(self) -> list[Payment]:
        stmt = select(Payment).order_by(Payment.id.desc())
        return list(self.db.scalars(stmt).all())

    def list_audit_logs(self, limit: int = 100) -> list[AuditLog]:
        stmt = select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)
        return list(self.db.scalars(stmt).all())
