from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.domains.users.models import ArcoRequest, DataConsent, User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, user_id: int) -> User | None:
        return self.db.get(User, user_id)

    def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email.lower())
        return self.db.scalars(stmt).first()

    def list_all(self) -> list[User]:
        stmt = select(User).order_by(User.id.asc())
        return list(self.db.scalars(stmt).all())

    def create(self, full_name: str, email: str, phone: str, password_hash: str, role: str) -> User:
        user = User(
            full_name=full_name,
            email=email.lower(),
            phone=phone,
            password_hash=password_hash,
            role=role,
            is_active=True,
        )
        self.db.add(user)
        self.db.flush()

        consent = DataConsent(
            user_id=user.id,
            policy_version=settings.privacy_policy_version,
            accepted=True,
        )
        self.db.add(consent)
        self.db.commit()
        self.db.refresh(user)
        return user

    def latest_consent(self, user_id: int) -> DataConsent | None:
        # Latest = highest id (timestamps can tie within one second).
        stmt = (
            select(DataConsent)
            .where(DataConsent.user_id == user_id)
            .order_by(DataConsent.id.desc())
            .limit(1)
        )
        return self.db.scalars(stmt).first()

    def append_consent(self, user_id: int, accepted: bool) -> DataConsent:
        record = DataConsent(
            user_id=user_id,
            policy_version=settings.privacy_policy_version,
            accepted=accepted,
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def update(
        self,
        user: User,
        full_name: str | None = None,
        phone: str | None = None,
        address_changes: dict[str, str | float | None] | None = None,
    ) -> User:
        if full_name is not None:
            user.full_name = full_name
        if phone is not None:
            user.phone = phone
        for field, value in (address_changes or {}).items():
            setattr(user, field, value)  # None is meaningful here: it clears the value
        self.db.commit()
        self.db.refresh(user)
        return user

    def create_arco_request(self, user: User, request_type: str, detail: str) -> ArcoRequest:
        arco = ArcoRequest(
            user_id=user.id,
            user_name=user.full_name,
            request_type=request_type,
            detail=detail,
            status="pendiente",
        )
        self.db.add(arco)
        self.db.commit()
        self.db.refresh(arco)
        return arco

    def list_arco_requests(self, user_id: int | None = None) -> list[ArcoRequest]:
        stmt = select(ArcoRequest).order_by(ArcoRequest.id.desc())
        if user_id is not None:
            stmt = stmt.where(ArcoRequest.user_id == user_id)
        return list(self.db.scalars(stmt).all())

    def get_arco_by_id(self, arco_id: int) -> ArcoRequest | None:
        return self.db.get(ArcoRequest, arco_id)

    def resolve_arco_request(self, arco: ArcoRequest, admin_response: str) -> ArcoRequest:
        arco.status = "respondida"
        arco.admin_response = admin_response
        arco.resolved_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(arco)
        return arco
