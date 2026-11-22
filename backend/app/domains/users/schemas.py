from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from app.core.rbac import UserRole
from app.shared.coordinates import Latitude, Longitude, ensure_both_or_neither


class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    phone: str = Field(default="", max_length=40)
    password: str = Field(..., min_length=6, max_length=128)
    accepts_privacy_policy: bool


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=40)
    # Partial update: an omitted field is left alone, an explicit null clears it
    # (distinguished through `model_fields_set`).
    address: str | None = Field(default=None, min_length=4, max_length=300)
    lat: Latitude | None = None
    lng: Longitude | None = None

    @model_validator(mode="after")
    def _coords_together(self) -> "UserUpdate":
        sent = {"lat", "lng"} & self.model_fields_set
        if len(sent) == 1:
            raise ValueError("lat and lng must be sent together.")
        ensure_both_or_neither(self.lat, self.lng)
        return self


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    phone: str
    role: UserRole
    is_active: bool
    created_at: datetime
    address: str | None = None
    lat: float | None = None
    lng: float | None = None


# Admin list: no delivery address / coordinates (avoids new PII exposure).
class UserListRead(UserRead):
    model_config = ConfigDict(from_attributes=True)

    address: str | None = Field(default=None, exclude=True)
    lat: float | None = Field(default=None, exclude=True)
    lng: float | None = Field(default=None, exclude=True)


class UserStatusUpdate(BaseModel):
    is_active: bool


ArcoType = Literal["Acceso", "Rectificación", "Cancelación", "Oposición"]


class ConsentRead(BaseModel):
    accepted: bool
    policy_version: str | None = None
    accepted_at: datetime | None = None


class ConsentUpdate(BaseModel):
    accepted: bool


class ArcoRequestCreate(BaseModel):
    request_type: ArcoType
    detail: str = Field(..., min_length=5, max_length=1000)


class ArcoRequestResolve(BaseModel):
    admin_response: str = Field(..., min_length=3, max_length=2000)


class ArcoRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    user_name: str
    request_type: str
    detail: str
    status: str
    admin_response: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None
