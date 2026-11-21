from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import CurrentUser, get_optional_user
from app.domains.reports.schemas import AuditLogRead, FinancialSummaryRead, KpiSummaryRead
from app.domains.reports.service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/kpis", response_model=KpiSummaryRead)
def get_kpis(
    _: CurrentUser | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> KpiSummaryRead:
    return ReportService(db).get_kpis()


@router.get("/financial", response_model=FinancialSummaryRead)
def get_financial_summary(
    _: CurrentUser | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> FinancialSummaryRead:
    return ReportService(db).get_financial_summary()


@router.get("/audit-logs", response_model=list[AuditLogRead])
def get_audit_logs(
    _: CurrentUser | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> list[AuditLogRead]:
    return ReportService(db).get_audit_logs()
