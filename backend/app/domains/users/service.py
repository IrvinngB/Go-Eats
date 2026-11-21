from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.domains.users.models import ArcoRequest, User
from app.domains.users.repository import UserRepository
from app.domains.users.schemas import (
    ArcoRequestCreate,
    ArcoRequestResolve,
    ConsentRead,
    UserUpdate,
)
from app.shared.audit import record_audit_event


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = UserRepository(db)

    def get_profile(self, user_id: int) -> User:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return user

    def update_profile(self, user_id: int, payload: UserUpdate) -> User:
        user = self.get_profile(user_id)
        updated = self.repo.update(user, full_name=payload.full_name, phone=payload.phone)
        record_audit_event(self.db, updated.full_name, "Actualizó datos de perfil", "acceso")
        return updated

    def get_consent(self, user_id: int) -> ConsentRead:
        record = self.repo.latest_consent(user_id)
        if record is None:
            return ConsentRead(accepted=False)
        return ConsentRead(
            accepted=record.accepted,
            policy_version=record.policy_version,
            accepted_at=record.accepted_at,
        )

    def set_consent(self, user_id: int, accepted: bool) -> ConsentRead:
        user = self.get_profile(user_id)
        self.repo.append_consent(user_id, accepted)
        record_audit_event(
            self.db,
            user.full_name,
            "Otorgó consentimiento Ley 81" if accepted else "Revocó consentimiento Ley 81",
            "arco",
        )
        return self.get_consent(user_id)

    def submit_arco(self, user_id: int, payload: ArcoRequestCreate) -> ArcoRequest:
        user = self.get_profile(user_id)
        arco = self.repo.create_arco_request(user, payload.request_type, payload.detail)
        record_audit_event(
            self.db, user.full_name, f"Presentó solicitud ARCO ({payload.request_type})", "arco"
        )
        return arco

    def list_arco(self, user_id: int | None = None) -> list[ArcoRequest]:
        return self.repo.list_arco_requests(user_id=user_id)

    def resolve_arco(self, arco_id: int, payload: ArcoRequestResolve) -> ArcoRequest:
        arco = self.repo.get_arco_by_id(arco_id)
        if not arco:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="ARCO request not found."
            )
        resolved = self.repo.resolve_arco_request(arco, payload.admin_response)
        record_audit_event(
            self.db, "Admin", f"Respondió solicitud ARCO de {arco.user_name}", "arco"
        )
        return resolved

    def list_users(self) -> list[User]:
        return self.repo.list_all()
