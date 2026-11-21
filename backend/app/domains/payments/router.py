from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import CurrentUser, UserRole, require_roles
from app.domains.payments.schemas import PaymentCreate, PaymentRead, PaymentStatusUpdate
from app.domains.payments.service import PaymentService
from app.domains.users.dependencies import require_active_consent

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/", response_model=list[PaymentRead])
def list_payments(
    status: str | None = Query(default=None),
    method: str | None = Query(default=None),
    _: CurrentUser = Depends(require_roles(UserRole.ACCOUNTANT, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> list[PaymentRead]:
    return PaymentService(db).list_payments(status_filter=status, method_filter=method)


@router.post("/", response_model=PaymentRead, status_code=201)
def process_payment(
    payload: PaymentCreate,
    current_user: CurrentUser = Depends(require_roles(UserRole.CUSTOMER)),
    _consent: CurrentUser = Depends(require_active_consent),
    db: Session = Depends(get_db),
) -> PaymentRead:
    return PaymentService(db).process_payment(current_user, payload)


@router.patch("/{code}/status", response_model=PaymentRead)
def reconcile_payment(
    code: str,
    payload: PaymentStatusUpdate,
    current_user: CurrentUser = Depends(require_roles(UserRole.ACCOUNTANT, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> PaymentRead:
    return PaymentService(db).reconcile_payment(
        code=code,
        payload=payload,
        actor=f"{current_user.role}:{current_user.user_id}",
    )


@router.get("/{code}/receipt.pdf")
def download_receipt_pdf(
    code: str,
    current_user: CurrentUser = Depends(
        require_roles(UserRole.ACCOUNTANT, UserRole.ADMIN, UserRole.CUSTOMER)
    ),
    db: Session = Depends(get_db),
) -> Response:
    pdf_bytes = PaymentService(db).build_receipt_pdf(current_user, code)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="comprobante-{code}.pdf"'},
    )
