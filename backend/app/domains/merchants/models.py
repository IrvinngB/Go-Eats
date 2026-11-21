from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    category_type: Mapped[str] = mapped_column(String(120), nullable=False)
    zone_slug: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    rating: Mapped[float] = mapped_column(Float, default=4.5, nullable=False)
    delivery_time: Mapped[str] = mapped_column(String(40), default="20-35 min", nullable=False)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    affiliation_status: Mapped[str] = mapped_column(
        String(30), default="en_revision", index=True, nullable=False
    )
    opens_at: Mapped[str] = mapped_column(String(10), default="09:00", nullable=False)
    closes_at: Mapped[str] = mapped_column(String(10), default="21:00", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    icon: Mapped[str] = mapped_column(String(40), default="Store", nullable=False)
    owner_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), unique=True, index=True, nullable=True
    )
