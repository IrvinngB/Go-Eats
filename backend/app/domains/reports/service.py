from sqlalchemy.orm import Session
from app.domains.reports.repository import ReportRepository
from app.domains.reports.schemas import FinancialSummaryRead, KpiSummaryRead
from app.shared.audit import AuditLog


class ReportService:
    def __init__(self, db: Session) -> None:
        self.repo = ReportRepository(db)

    def get_kpis(self) -> KpiSummaryRead:
        return KpiSummaryRead(
            orders_today=self.repo.count_orders(),
            total_revenue=self.repo.sum_revenue(),
            avg_delivery_time="28 min",
            active_merchants=self.repo.count_active_merchants(),
        )

    def get_financial_summary(self) -> FinancialSummaryRead:
        payments = self.repo.list_payments()
        paid_total = round(sum(p.total for p in payments if p.status == "pagado"), 2)
        pending_total = round(sum(p.total for p in payments if p.status == "pendiente"), 2)
        commissions = round(sum(p.commission for p in payments if p.status != "fallido"), 2)
        return FinancialSummaryRead(
            total_transactions=len(payments),
            paid_total=paid_total,
            pending_total=pending_total,
            total_commissions=commissions,
        )

    def get_audit_logs(self) -> list[AuditLog]:
        return self.repo.list_audit_logs()
