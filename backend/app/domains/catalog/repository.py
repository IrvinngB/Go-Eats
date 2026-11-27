from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.domains.catalog.models import Product
from app.domains.catalog.schemas import ProductCreate, ProductUpdate


class ProductRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_all(self) -> list[Product]:
        stmt = select(Product).order_by(Product.id.asc())
        return list(self.db.scalars(stmt).all())

    def list_by_merchant(self, merchant_code: str) -> list[Product]:
        stmt = (
            select(Product)
            .where(Product.merchant_code == merchant_code)
            .order_by(Product.id.asc())
        )
        return list(self.db.scalars(stmt).all())

    def count_by_merchant(self, merchant_code: str) -> int:
        stmt = select(func.count(Product.id)).where(Product.merchant_code == merchant_code)
        return self.db.scalar(stmt) or 0

    def get_by_code(self, code: str) -> Product | None:
        return self.db.scalars(select(Product).where(Product.code == code)).first()

    def get_by_id_or_code(self, identifier: str) -> Product | None:
        if identifier.isdigit():
            product = self.db.get(Product, int(identifier))
            if product:
                return product
        stmt = select(Product).where(Product.code == identifier)
        return self.db.scalars(stmt).first()

    def create(self, merchant_code: str, payload: ProductCreate) -> Product:
        count = len(self.list_by_merchant(merchant_code)) + 100
        code = f"{merchant_code}-p{count}"
        product = Product(
            code=code,
            merchant_code=merchant_code,
            name=payload.name,
            description=payload.description,
            category=payload.category,
            price=payload.price,
            promo_price=payload.promo_price,
            is_available=payload.is_available,
        )
        self.db.add(product)
        self.db.commit()
        self.db.refresh(product)
        return product

    def update(self, product: Product, payload: ProductUpdate) -> Product:
        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(product, field, value)
        self.db.commit()
        self.db.refresh(product)
        return product

    def delete(self, product: Product) -> None:
        self.db.delete(product)
        self.db.commit()
