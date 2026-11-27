from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rate_limit import limit_by_ip
from app.domains.auth.schemas import LoginRequest, RefreshTokenRequest, TokenResponse
from app.domains.auth.service import AuthService
from app.domains.users.schemas import UserCreate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=201,
    # Account farming: 5 sign-ups per IP every 10 minutes.
    dependencies=[Depends(limit_by_ip("register", 5, 600))],
)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> TokenResponse:
    return AuthService(db).register(payload)


@router.post(
    "/login",
    response_model=TokenResponse,
    # Password guessing: 10 attempts per IP per minute.
    dependencies=[Depends(limit_by_ip("login", 10, 60))],
)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return AuthService(db).login(payload)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return AuthService(db).refresh(payload)
