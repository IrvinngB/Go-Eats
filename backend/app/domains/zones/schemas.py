from pydantic import BaseModel, ConfigDict, Field


class ZoneCreate(BaseModel):
    slug: str = Field(..., min_length=2, max_length=80)
    name: str = Field(..., min_length=2, max_length=120)
    delivery_fee: float = Field(..., ge=0)
    distance_km: float = Field(..., ge=0)


class ZoneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    delivery_fee: float
    distance_km: float
    is_active: bool
