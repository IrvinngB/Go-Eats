from datetime import datetime, timezone
from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, Session, mapped_column
from app.core.database import Base


class AuditLog(Base):
    """Append-only operational audit log (12-month retention policy)."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    actor: Mapped[str] = mapped_column(String(120), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class AuthEvent(Base):
    """Append-only authentication events log."""

    __tablename__ = "auth_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    event: Mapped[str] = mapped_column(String(80), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class DataAccessLog(Base):
    """Append-only personal data access log (Ley 81 compliance)."""

    __tablename__ = "data_access_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    actor_id: Mapped[int] = mapped_column(Integer, nullable=False)
    subject_user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    operation: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


def record_audit_event(db: Session, actor: str, action: str, event_type: str = "system") -> AuditLog:
    entry = AuditLog(actor=actor, action=action, event_type=event_type)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def record_auth_event(
    db: Session, user_email: str, event: str, ip_address: str | None = None
) -> AuthEvent:
    entry = AuthEvent(user_email=user_email, event=event, ip_address=ip_address)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
