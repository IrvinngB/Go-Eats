from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: str = Field(default="", max_length=1000)
    category: str = Field(default="General", max_length=60)
    price: float = Field(..., gt=0)
    promo_price: float | None = Field(default=None, gt=0)
    is_available: bool = True

    @model_validator(mode="after")
    def validate_promo_lt_price(self) -> "ProductCreate":
        if self.promo_price is not None and self.promo_price >= self.price:
            raise ValueError("Promo price must be strictly lower than the regular price.")
        return self


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=1000)
    category: str | None = Field(default=None, max_length=60)
    price: float | None = Field(default=None, gt=0)
    promo_price: float | None = Field(default=None, gt=0)
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
