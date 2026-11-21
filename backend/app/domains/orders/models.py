from datetime import datetime, timezone
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, select
from sqlalchemy.orm import Mapped, column_property, mapped_column, relationship
from app.core.database import Base
from app.domains.payments.models import Payment


class Order(Base):
    """Order entity with frozen pricing and delivery address snapshots (Section 3.4)."""

    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    merchant_code: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    merchant_name: Mapped[str] = mapped_column(String(150), nullable=False)
    customer_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    customer_name: Mapped[str] = mapped_column(String(150), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    zone_slug: Mapped[str] = mapped_column(String(80), nullable=False)
    delivery_address: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    delivery_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    payment_method: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="pendiente", index=True, nullable=False)
    courier_code: Mapped[str | None] = mapped_column(String(40), index=True, nullable=True)
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    subtotal: Mapped[float] = mapped_column(Float, nullable=False)
    delivery_fee: Mapped[float] = mapped_column(Float, nullable=False)
    total: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )
    rating: Mapped["OrderRating | None"] = relationship(
        "OrderRating", back_populates="order", uselist=False, cascade="all, delete-orphan"
    )


# Read-only: status of the order's latest payment (None while unpaid). Legacy rows read as-is.
Order.payment_status = column_property(
    select(Payment.status)
    .where(Payment.order_code == Order.code)
    .order_by(Payment.id.desc())
    .limit(1)
    .correlate_except(Payment)
    .scalar_subquery(),
    deferred=False,
)


class OrderItem(Base):
    """Frozen line item snapshot with historical unit_price (Section 3.4)."""

    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False, index=True)
    product_code: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)

    order: Mapped["Order"] = relationship("Order", back_populates="items")


class OrderStatusHistory(Base):
    """Append-only order state transition audit table (Section 3.3 & 3.4)."""

    __tablename__ = "order_status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_code: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    previous_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    new_status: Mapped[str] = mapped_column(String(40), nullable=False)
    actor: Mapped[str] = mapped_column(String(120), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class OrderRating(Base):
    """Customer rating for merchant service and courier attention (RF-20)."""

    __tablename__ = "order_ratings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id"), unique=True, nullable=False, index=True
    )
    merchant_stars: Mapped[int] = mapped_column(Integer, nullable=False)
    courier_stars: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    order: Mapped["Order"] = relationship("Order", back_populates="rating")
