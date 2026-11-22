from pydantic import BaseModel, ConfigDict, Field


class MerchantCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=40)
    name: str = Field(..., min_length=2, max_length=150)
    category_type: str = Field(..., min_length=2, max_length=120)
    zone_slug: str = Field(..., min_length=2, max_length=80)
    delivery_time: str = "20-35 min"
    opens_at: str = "09:00"
    closes_at: str = "21:00"
    description: str = ""
    icon: str = "Store"


class MerchantScheduleUpdate(BaseModel):
    opens_at: str = Field(..., min_length=4, max_length=10)
    closes_at: str = Field(..., min_length=4, max_length=10)
    is_open: bool | None = None


class MerchantAffiliationUpdate(BaseModel):
    affiliation_status: str = Field(..., description="activo | suspendido | rechazado | en_revision")
    is_open: bool | None = None


class MerchantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    category_type: str
    zone_slug: str
    rating: float
    delivery_time: str
    is_open: bool
    affiliation_status: str
    opens_at: str
    closes_at: str
    description: str
    icon: str
