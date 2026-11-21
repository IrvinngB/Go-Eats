from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class PaymentCreate(BaseModel):
    order_code: str
    merchant_name: str
    customer_name: str
    method: Literal["contr_entrega", "yappy"]
    subtotal: float = Field(..., ge=0)
    delivery_fee: float = Field(..., ge=0)
    simulate_failure: bool = False


class PaymentStatusUpdate(BaseModel):
    status: str = Field(..., description="pagado | pendiente | fallido")


class PaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    order_code: str
    merchant_name: str
    customer_name: str
    method: str
    subtotal: float
    delivery_fee: float
    commission: float
    total: float
    status: str
    provider_reference: str
    created_at: datetime
