import jwt
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.domains.auth.schemas import LoginRequest, RefreshTokenRequest, TokenResponse
from app.domains.users.repository import UserRepository
from app.domains.users.schemas import UserCreate, UserRead
from app.shared.audit import record_audit_event, record_auth_event


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.user_repo = UserRepository(db)

    def register(self, payload: UserCreate) -> TokenResponse:
        if not payload.accepts_privacy_policy:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Must accept the Ley 81 personal data protection policy (RF-07).",
            )
        existing = self.user_repo.get_by_email(payload.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is already registered.",
            )
        user = self.user_repo.create(
            full_name=payload.full_name,
            email=payload.email,
            phone=payload.phone,
            password_hash=hash_password(payload.password),
            role=payload.role.value,
        )
        record_auth_event(self.db, user.email, "register_success")
        record_audit_event(
            self.db, user.full_name, f"Registro de usuario ({user.role}) con Ley 81", "acceso"
        )
        return self._issue_tokens(user)

    def login(self, payload: LoginRequest) -> TokenResponse:
        user = self.user_repo.get_by_email(payload.email)
        if not user or not verify_password(payload.password, user.password_hash):
            record_auth_event(self.db, payload.email, "login_failed")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is suspended.",
            )
        active_role = payload.role.value if payload.role else user.role
        record_auth_event(self.db, user.email, f"login_success:{active_role}")
        return self._issue_tokens(user, role_override=active_role)

    def refresh(self, payload: RefreshTokenRequest) -> TokenResponse:
        try:
            decoded = decode_token(payload.refresh_token)
            if decoded.get("type") != "refresh":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token.",
                )
            user_id = int(decoded["sub"])
            role = str(decoded["role"])
        except (jwt.PyJWTError, KeyError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token.",
            ) from exc

        user = self.user_repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive.",
            )
        return self._issue_tokens(user, role_override=role)

    def _issue_tokens(self, user, role_override: str | None = None) -> TokenResponse:
        role = role_override or user.role
        access_token = create_access_token(subject=str(user.id), role=role)
        refresh_token = create_refresh_token(subject=str(user.id), role=role)
        user_read = UserRead.model_validate(user)
        user_read.role = role
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=user_read,
        )
