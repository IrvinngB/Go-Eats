from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.rbac import CurrentUser, UserRole
from app.domains.catalog.models import Product
from app.domains.catalog.repository import ProductRepository
from app.domains.catalog.schemas import ProductCreate, ProductUpdate
from app.domains.merchants.repository import MerchantRepository
from app.shared.audit import record_audit_event


# Generous for a real menu, but stops a merchant account from flooding the public catalog.
PRODUCTS_PER_MERCHANT_LIMIT = 200


class CatalogService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = ProductRepository(db)
        self.merchant_repo = MerchantRepository(db)

    def _ensure_merchant_access(self, user: CurrentUser, merchant_code: str) -> None:
        merchant = self.merchant_repo.get_by_code(merchant_code)
        if not merchant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Merchant not found."
            )
        if user.role == UserRole.MERCHANT and merchant.owner_user_id != user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to modify this merchant's catalog.",
            )

    def list_all_products(self) -> list[Product]:
        return self.repo.list_all()

    def list_merchant_products(self, merchant_code: str) -> list[Product]:
        return self.repo.list_by_merchant(merchant_code)

    def get_product(self, identifier: str) -> Product:
        product = self.repo.get_by_id_or_code(identifier)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Product not found."
            )
        return product

    def create_product(
        self, user: CurrentUser, merchant_code: str, payload: ProductCreate
    ) -> Product:
        self._ensure_merchant_access(user, merchant_code)
        if self.repo.count_by_merchant(merchant_code) >= PRODUCTS_PER_MERCHANT_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El comercio alcanzó el máximo de {PRODUCTS_PER_MERCHANT_LIMIT} productos.",
            )
        payload.category = payload.category.strip() or "General"
        product = self.repo.create(merchant_code, payload)
        record_audit_event(
            self.db,
            f"Comercio {merchant_code}",
            f"Agregó producto '{product.name}' (B/ {product.price:.2f})",
            "comercio",
        )
        return product

    def update_product(
        self, user: CurrentUser, identifier: str, payload: ProductUpdate
    ) -> Product:
        product = self.get_product(identifier)
        self._ensure_merchant_access(user, product.merchant_code)

        effective_price = payload.price if payload.price is not None else product.price
        effective_promo = (
            payload.promo_price
            if "promo_price" in payload.model_fields_set
            else product.promo_price
        )
        if effective_promo is not None and effective_promo >= effective_price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Promo price must be strictly lower than the regular price.",
            )
        if "category" in payload.model_fields_set and payload.category is not None:
            payload.category = payload.category.strip() or "General"

        updated = self.repo.update(product, payload)
        record_audit_event(
            self.db,
            f"Comercio {updated.merchant_code}",
            f"Actualizó producto '{updated.name}'",
            "comercio",
        )
        return updated

    def delete_product(self, user: CurrentUser, identifier: str) -> None:
        product = self.get_product(identifier)
        self._ensure_merchant_access(user, product.merchant_code)
        merchant_code = product.merchant_code
        product_name = product.name
        self.repo.delete(product)
        record_audit_event(
            self.db,
            f"Comercio {merchant_code}",
            f"Eliminó producto '{product_name}'",
            "comercio",
        )
