from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class OrderItemCreate(BaseModel):
    # Price and name are server-derived from the catalog; extra client fields are ignored.
    product_code: str
    quantity: int = Field(..., ge=1, le=50)
    notes: str = ""


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
    delivery_address: str = Field(..., min_length=4)
    notes: str = ""
    payment_method: PaymentMethod
    items: list[OrderItemCreate] = Field(..., min_length=1)


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
    reason: str | None = None


class OrderAssignCourier(BaseModel):
    courier_code: str


class OrderRatingCreate(BaseModel):
    merchant_stars: int = Field(..., ge=1, le=5)
    courier_stars: int = Field(..., ge=1, le=5)
    comment: str = ""


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
