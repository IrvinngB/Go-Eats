from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class PaymentCreate(BaseModel):
    """Only the order code and method travel: amounts and names come from the persisted order.

    Unknown fields (client amounts, names, any card data) are dropped by pydantic, never stored.
    """

    order_code: str
    method: Literal["contr_entrega", "yappy"]
    # Honored only when the server-side DEV_SIMULATE_FAILURE flag is on.
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
