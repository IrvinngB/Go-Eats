from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.rbac import CurrentUser, UserRole
from app.domains.delivery.models import Courier
from app.domains.delivery.repository import CourierRepository
from app.domains.delivery.schemas import CourierAffiliationUpdate, CourierAvailabilityUpdate
from app.shared.audit import record_audit_event


class DeliveryService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = CourierRepository(db)

    def list_couriers(self, only_available: bool = False) -> list[Courier]:
        return self.repo.list_couriers(only_available=only_available)

    def get_mine(self, user_id: int) -> Courier:
        courier = self.repo.get_by_user(user_id)
        if not courier:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="no_linked_entity")
        return courier

    def get_courier(self, code: str) -> Courier:
        courier = self.repo.get_by_code(code)
        if not courier:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Courier not found."
            )
        return courier

    def update_availability(
        self, user: CurrentUser, code: str, payload: CourierAvailabilityUpdate
    ) -> Courier:
        courier = self.get_courier(code)
        if user.role == UserRole.COURIER and courier.user_id != user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to modify this courier's availability.",
            )
        if payload.is_available and courier.affiliation_status != "activo":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive or suspended courier cannot become available.",
            )
        updated = self.repo.set_availability(courier, payload.is_available)
        state_str = "en línea" if updated.is_available else "desconectado"
        record_audit_event(
            self.db, updated.name, f"Cambió disponibilidad a {state_str}", "pedido"
        )
        return updated

    def update_affiliation(self, code: str, payload: CourierAffiliationUpdate) -> Courier:
        courier = self.get_courier(code)
        updated = self.repo.set_affiliation(courier, payload.affiliation_status)
        record_audit_event(
            self.db,
            "Admin",
            f"Cambió afiliación del repartidor {updated.name} a {updated.affiliation_status}",
            "pedido",
        )
        return updated
