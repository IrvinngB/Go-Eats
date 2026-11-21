from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.domains.catalog.models import Product
from app.domains.catalog.repository import ProductRepository
from app.domains.catalog.schemas import ProductCreate, ProductUpdate
from app.shared.audit import record_audit_event


class CatalogService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = ProductRepository(db)

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

    def create_product(self, merchant_code: str, payload: ProductCreate) -> Product:
        product = self.repo.create(merchant_code, payload)
        record_audit_event(
            self.db,
            f"Comercio {merchant_code}",
            f"Agregó producto '{product.name}' (B/ {product.price:.2f})",
            "comercio",
        )
        return product

    def update_product(self, identifier: str, payload: ProductUpdate) -> Product:
        product = self.get_product(identifier)
        updated = self.repo.update(product, payload)
        record_audit_event(
            self.db,
            f"Comercio {updated.merchant_code}",
            f"Actualizó producto '{updated.name}'",
            "comercio",
        )
        return updated
