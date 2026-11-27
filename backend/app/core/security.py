from datetime import datetime, timedelta, timezone
from typing import Any
import bcrypt
import jwt
from app.core.config import settings


# bcrypt only reads the first 72 bytes; bcrypt>=5 raises instead of silently truncating.
BCRYPT_MAX_BYTES = 72


def password_fits_bcrypt(password: str) -> bool:
    return len(password.encode("utf-8")) <= BCRYPT_MAX_BYTES


def hash_password(password: str) -> str:
    if not password_fits_bcrypt(password):
        raise ValueError(f"Password must be at most {BCRYPT_MAX_BYTES} bytes.")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # A password bcrypt could never have hashed cannot match: answer False, never raise.
    if not password_fits_bcrypt(plain_password):
        return False
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(subject: str, role: str, extra: dict[str, Any] | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "type": "access",
        "exp": expire,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "type": "refresh",
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
