from pydantic import BaseModel, EmailStr, Field
from app.core.rbac import UserRole
from app.domains.users.schemas import UserRead


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=4)
    role: UserRole | None = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserRead
