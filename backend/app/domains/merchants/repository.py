from sqlalchemy import select
from sqlalchemy.orm import Session
from app.domains.merchants.models import Merchant


class MerchantRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_merchants(self, zone_slug: str | None = None) -> list[Merchant]:
        stmt = select(Merchant).order_by(Merchant.id.asc())
        if zone_slug:
            stmt = stmt.where(Merchant.zone_slug == zone_slug)
        return list(self.db.scalars(stmt).all())

    def get_by_code(self, code: str) -> Merchant | None:
        stmt = select(Merchant).where(Merchant.code == code)
        return self.db.scalars(stmt).first()

    def update_schedule(
        self, merchant: Merchant, opens_at: str, closes_at: str, is_open: bool | None = None
    ) -> Merchant:
        merchant.opens_at = opens_at
        merchant.closes_at = closes_at
        if is_open is not None:
            merchant.is_open = is_open
        self.db.commit()
        self.db.refresh(merchant)
        return merchant

    def update_affiliation(
        self, merchant: Merchant, affiliation_status: str, is_open: bool | None = None
    ) -> Merchant:
        merchant.affiliation_status = affiliation_status
        if is_open is not None:
            merchant.is_open = is_open
        elif affiliation_status != "activo":
            merchant.is_open = False
        self.db.commit()
        self.db.refresh(merchant)
        return merchant
