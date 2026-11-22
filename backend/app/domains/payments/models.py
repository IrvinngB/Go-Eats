from datetime import datetime, timezone
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    order_code: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    merchant_name: Mapped[str] = mapped_column(String(150), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(150), nullable=False)
    method: Mapped[str] = mapped_column(String(40), nullable=False)
    subtotal: Mapped[float] = mapped_column(Float, nullable=False)
    delivery_fee: Mapped[float] = mapped_column(Float, nullable=False)
    commission: Mapped[float] = mapped_column(Float, nullable=False)
    total: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pendiente", index=True, nullable=False)
    provider_reference: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class PaymentStatusHistory(Base):
    """Append-only payment status transition audit log (Section 3.4)."""

    __tablename__ = "payment_status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    payment_code: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    previous_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    new_status: Mapped[str] = mapped_column(String(30), nullable=False)
    actor: Mapped[str] = mapped_column(String(120), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class Receipt(Base):
    """Digital payment receipt metadata (RF-12)."""

    __tablename__ = "receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    receipt_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id"), nullable=False, index=True)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
