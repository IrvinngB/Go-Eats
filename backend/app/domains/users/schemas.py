from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.core.rbac import UserRole


class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    phone: str = Field(default="", max_length=40)
    password: str = Field(..., min_length=6, max_length=128)
    accepts_privacy_policy: bool


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=40)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    phone: str
    role: UserRole
    is_active: bool
    created_at: datetime


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
