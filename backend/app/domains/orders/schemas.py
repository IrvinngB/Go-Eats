from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.shared.coordinates import Latitude, Longitude, ensure_both_or_neither


class OrderItemCreate(BaseModel):
    # Price and name are server-derived from the catalog; extra client fields are ignored.
    product_code: str
    quantity: int = Field(..., ge=1, le=50)
    notes: str = Field(default="", max_length=200)


class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_code: str
    name: str
    unit_price: float
    quantity: int
    notes: str


# `yappy` is the internal id of the single simulated electronic gateway.
PaymentMethod = Literal["contr_entrega", "yappy"]


class OrderCreate(BaseModel):
    # Names, fee, prices and totals sent by the client are ignored (pydantic drops extras).
    merchant_code: str
    zone_slug: str
    delivery_address: str = Field(..., min_length=4, max_length=300)
    # Optional frozen snapshot of the pin; taken from the payload only, never from the profile.
    delivery_lat: Latitude | None = None
    delivery_lng: Longitude | None = None
    notes: str = Field(default="", max_length=500)
    payment_method: PaymentMethod
    # Each line costs a catalog lookup: cap the cart so one request cannot fan out unbounded.
    items: list[OrderItemCreate] = Field(..., min_length=1, max_length=30)

    @model_validator(mode="after")
    def _coords_together(self) -> "OrderCreate":
        ensure_both_or_neither(self.delivery_lat, self.delivery_lng)
        return self


OrderStatus = Literal[
    "pendiente",
    "confirmado",
    "en_preparacion",
    "listo_para_recoger",
    "en_camino",
    "entregado",
    "rechazado",
    "cancelado",
]


class OrderStatusUpdate(BaseModel):
    # Canonical values only: spaced or accented variants are rejected with 422, never normalized.
    status: OrderStatus
    reason: str | None = Field(default=None, max_length=500)


class OrderCancel(BaseModel):
    reason: str = Field(..., max_length=500)


class OrderAssignCourier(BaseModel):
    courier_code: str


class OrderRatingCreate(BaseModel):
    merchant_stars: int = Field(..., ge=1, le=5)
    courier_stars: int = Field(..., ge=1, le=5)
    comment: str = Field(default="", max_length=1000)


class OrderRatingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    merchant_stars: int
    courier_stars: int
    comment: str
    created_at: datetime


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    merchant_code: str
    merchant_name: str
    customer_id: int
    customer_name: str
    customer_phone: str
    zone_slug: str
    delivery_address: str
    delivery_lat: float | None = None
    delivery_lng: float | None = None
    notes: str
    payment_method: str
    status: str
    courier_code: str | None = None
    cancellation_reason: str | None = None
    payment_status: str | None = None
    subtotal: float
    delivery_fee: float
    total: float
    created_at: datetime
    items: list[OrderItemRead] = []
    rating: OrderRatingRead | None = None
