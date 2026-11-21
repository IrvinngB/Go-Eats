from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import CurrentUser, UserRole, get_current_user, require_roles
from app.domains.users.schemas import (
    ArcoRequestCreate,
    ArcoRequestRead,
    ArcoRequestResolve,
    ConsentRead,
    ConsentUpdate,
    UserListRead,
    UserRead,
    UserUpdate,
)
from app.domains.users.service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
def get_my_profile(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserRead:
    return UserService(db).get_profile(current_user.user_id)


@router.put("/me", response_model=UserRead)
def update_my_profile(
    payload: UserUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserRead:
    return UserService(db).update_profile(current_user.user_id, payload)


@router.get("/me/consent", response_model=ConsentRead)
def get_my_consent(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConsentRead:
    return UserService(db).get_consent(current_user.user_id)


@router.put("/me/consent", response_model=ConsentRead)
def set_my_consent(
    payload: ConsentUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConsentRead:
    return UserService(db).set_consent(current_user.user_id, payload.accepted)


@router.get("/me/arco", response_model=list[ArcoRequestRead])
def list_my_arco_requests(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ArcoRequestRead]:
    return UserService(db).list_arco(current_user.user_id)


@router.post("/me/arco", response_model=ArcoRequestRead, status_code=201)
def create_arco_request(
    payload: ArcoRequestCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ArcoRequestRead:
    return UserService(db).submit_arco(current_user.user_id, payload)


@router.get("/arco", response_model=list[ArcoRequestRead])
def list_arco_requests(
    _: CurrentUser = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> list[ArcoRequestRead]:
    return UserService(db).list_arco()


@router.post("/arco/{arco_id}/resolve", response_model=ArcoRequestRead)
def resolve_arco_request(
    arco_id: int,
    payload: ArcoRequestResolve,
    _: CurrentUser = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> ArcoRequestRead:
    return UserService(db).resolve_arco(arco_id, payload)


@router.get("/", response_model=list[UserListRead])
def list_all_users(
    _: CurrentUser = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> list[UserListRead]:
    return UserService(db).list_users()
