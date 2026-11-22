from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import CurrentUser, UserRole, require_roles
from app.domains.catalog.schemas import ProductCreate, ProductRead, ProductUpdate
from app.domains.catalog.service import CatalogService

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/products", response_model=list[ProductRead])
def list_all_products(db: Session = Depends(get_db)) -> list[ProductRead]:
    return CatalogService(db).list_all_products()


@router.get("/merchants/{merchant_code}/products", response_model=list[ProductRead])
def list_merchant_products(
    merchant_code: str, db: Session = Depends(get_db)
) -> list[ProductRead]:
    return CatalogService(db).list_merchant_products(merchant_code)


@router.get("/products/{product_id}", response_model=ProductRead)
def get_product(product_id: str, db: Session = Depends(get_db)) -> ProductRead:
    return CatalogService(db).get_product(product_id)


@router.post("/merchants/{merchant_code}/products", response_model=ProductRead, status_code=201)
def create_product(
    merchant_code: str,
    payload: ProductCreate,
    current_user: CurrentUser = Depends(require_roles(UserRole.MERCHANT, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> ProductRead:
    return CatalogService(db).create_product(current_user, merchant_code, payload)


@router.put("/products/{product_id}", response_model=ProductRead)
def update_product(
    product_id: str,
    payload: ProductUpdate,
    current_user: CurrentUser = Depends(require_roles(UserRole.MERCHANT, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> ProductRead:
    return CatalogService(db).update_product(current_user, product_id, payload)


@router.delete("/products/{product_id}", status_code=204)
def delete_product(
    product_id: str,
    current_user: CurrentUser = Depends(require_roles(UserRole.MERCHANT, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> Response:
    CatalogService(db).delete_product(current_user, product_id)
    return Response(status_code=204)
