from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import CurrentUser, UserRole, get_current_user
from app.domains.users.repository import UserRepository

CONSENT_REQUIRED = "consent_required"


def require_active_consent(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentUser:
    """Customer create paths need an accepted latest consent (missing counts as not accepted).

    Declare it AFTER the role dependency so role errors win. Other roles pass through untouched.
    """
    if current_user.role != UserRole.CUSTOMER:
        return current_user
    latest = UserRepository(db).latest_consent(current_user.user_id)
    if latest is None or not latest.accepted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=CONSENT_REQUIRED)
    return current_user
