from pydantic import BaseModel, ConfigDict, Field


class CourierAvailabilityUpdate(BaseModel):
    is_available: bool


class CourierAffiliationUpdate(BaseModel):
    affiliation_status: str = Field(..., description="activo | suspendido | rechazado | en_revision")


class CourierRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    phone: str
    zone_slug: str
    rating: float
    is_available: bool
    affiliation_status: str
