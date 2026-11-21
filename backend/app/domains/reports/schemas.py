from datetime import datetime
from pydantic import BaseModel, ConfigDict


class KpiSummaryRead(BaseModel):
    orders_today: int
    total_revenue: float
    avg_delivery_time: str
    active_merchants: int


class FinancialSummaryRead(BaseModel):
    total_transactions: int
    paid_total: float
    pending_total: float
    total_commissions: float


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor: str
    event_type: str
    action: str
    created_at: datetime
