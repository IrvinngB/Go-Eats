from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.domains.merchants.models import Merchant
from app.domains.merchants.repository import MerchantRepository
from app.domains.merchants.schemas import MerchantAffiliationUpdate, MerchantScheduleUpdate
from app.shared.audit import record_audit_event


class MerchantService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = MerchantRepository(db)

    def list_merchants(self, zone_slug: str | None = None) -> list[Merchant]:
        return self.repo.list_merchants(zone_slug=zone_slug)

    def get_merchant(self, code: str) -> Merchant:
        merchant = self.repo.get_by_code(code)
        if not merchant:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant not found.")
        return merchant

    def update_schedule(self, code: str, payload: MerchantScheduleUpdate) -> Merchant:
        merchant = self.get_merchant(code)
        updated = self.repo.update_schedule(
            merchant,
            opens_at=payload.opens_at,
            closes_at=payload.closes_at,
            is_open=payload.is_open,
        )
        record_audit_event(
            self.db,
            updated.name,
            f"Actualizó horario ({updated.opens_at} - {updated.closes_at})",
            "comercio",
        )
        return updated

    def update_affiliation(self, code: str, payload: MerchantAffiliationUpdate) -> Merchant:
        merchant = self.get_merchant(code)
        updated = self.repo.update_affiliation(
            merchant,
            affiliation_status=payload.affiliation_status,
            is_open=payload.is_open,
        )
        record_audit_event(
            self.db,
            "Admin",
            f"Cambió estado de afiliación de {updated.name} a {updated.affiliation_status}",
            "comercio",
        )
        return updated
