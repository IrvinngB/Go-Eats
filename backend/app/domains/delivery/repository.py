from sqlalchemy import select
from sqlalchemy.orm import Session
from app.domains.delivery.models import Courier


class CourierRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_couriers(self, only_available: bool = False) -> list[Courier]:
        stmt = select(Courier).order_by(Courier.id.asc())
        if only_available:
            stmt = stmt.where(
                Courier.is_available.is_(True), Courier.affiliation_status == "activo"
            )
        return list(self.db.scalars(stmt).all())

    def get_by_code(self, code: str) -> Courier | None:
        stmt = select(Courier).where(Courier.code == code)
        return self.db.scalars(stmt).first()

    def set_availability(self, courier: Courier, is_available: bool) -> Courier:
        courier.is_available = is_available
        self.db.commit()
        self.db.refresh(courier)
        return courier

    def set_affiliation(self, courier: Courier, affiliation_status: str) -> Courier:
        courier.affiliation_status = affiliation_status
        if affiliation_status != "activo":
            courier.is_available = False
        self.db.commit()
        self.db.refresh(courier)
        return courier
