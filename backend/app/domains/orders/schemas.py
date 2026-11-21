from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class OrderItemCreate(BaseModel):
    product_code: str
    name: str
    unit_price: float = Field(..., gt=0)
    quantity: int = Field(..., ge=1)
    notes: str = ""


class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_code: str
    name: str
    unit_price: float
    quantity: int
    notes: str


class OrderCreate(BaseModel):
    merchant_code: str
    merchant_name: str
    customer_name: str
    customer_phone: str = ""
    zone_slug: str
    delivery_address: str = Field(..., min_length=4)
    notes: str = ""
    payment_method: str = Field(..., description="contr_entrega | tarjeta | yappy")
    delivery_fee: float = Field(..., ge=0)
    items: list[OrderItemCreate] = Field(..., min_length=1)


class OrderStatusUpdate(BaseModel):
    status: str = Field(
        ...,
        description="pendiente | confirmado | en_preparacion | listo_para_recoger | en_camino | entregado | cancelado | rechazado",
    )
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
    subtotal: float
    delivery_fee: float
    total: float
    created_at: datetime
    items: list[OrderItemRead] = []
    rating: OrderRatingRead | None = None
