from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: str = ""
    category: str = "General"
    price: float = Field(..., gt=0)
    promo_price: float | None = Field(default=None, gt=0)
    is_available: bool = True


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = None
    category: str | None = None
    price: float | None = Field(default=None, gt=0)
    promo_price: float | None = None
    is_available: bool | None = None


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    merchant_code: str
    name: str
    description: str
    category: str
    price: float
    promo_price: float | None = None
    is_available: bool
