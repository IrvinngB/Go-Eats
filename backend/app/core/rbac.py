from enum import StrEnum
from typing import Callable
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token

bearer_scheme = HTTPBearer(auto_error=False)


class UserRole(StrEnum):
    CUSTOMER = "customer"
    MERCHANT = "merchant"
    COURIER = "courier"
    ACCOUNTANT = "accountant"
    ADMIN = "admin"


class CurrentUser(BaseModel):
    user_id: int
    role: UserRole


# Plain SQL keeps core free of domain-model imports (layering: core never imports domains).
_ACTIVE_USER_SQL = text("SELECT is_active FROM users WHERE id = :id")


def _is_active_user(db: Session, user_id: int) -> bool:
    """Suspension (RF-17) must bite on the next request, not when the access token expires."""
    return bool(db.execute(_ACTIVE_USER_SQL, {"id": user_id}).scalar())


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
        )
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type.",
            )
        current = CurrentUser(user_id=int(payload["sub"]), role=UserRole(payload["role"]))
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        ) from exc
    if not _is_active_user(db, current.user_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )
    return current


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> CurrentUser | None:
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            return None
        current = CurrentUser(user_id=int(payload["sub"]), role=UserRole(payload["role"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
    return current if _is_active_user(db, current.user_id) else None


def require_roles(*allowed_roles: UserRole) -> Callable[[CurrentUser], CurrentUser]:
    def dependency(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not authorized for this resource.",
            )
        return current_user

    return dependency
