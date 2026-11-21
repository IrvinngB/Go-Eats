from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.domains.catalog.models import Product
from app.domains.delivery.models import Courier
from app.domains.merchants.models import Merchant
from app.domains.users.models import DataConsent, User
from app.domains.zones.models import Zone

DEFAULT_PASSWORD = "Passw0rd!"
# Precomputed bcrypt hash of DEFAULT_PASSWORD so tests do not pay hashing cost.
PASSWORD_HASH = "$2b$12$xKq/PsqRNfDS6ST7uBNn6.N55Q5EOyo2Ci41mW63n4NShXwG32umC"


def make_user(
    db: Session,
    email: str = "user@test.com",
    role: str = "customer",
    full_name: str = "Test User",
    phone: str = "",
    is_active: bool = True,
    consent: bool = True,
) -> User:
    user = User(
        full_name=full_name,
        email=email,
        phone=phone,
        password_hash=PASSWORD_HASH,
        role=role,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    if consent:
        # Mirrors register and the seed: every real user starts with accepted consent (PR9 gate).
        make_consent(db, user, True)
    return user


def make_consent(db: Session, user: User, accepted: bool, accepted_at=None) -> DataConsent:
    record = DataConsent(user_id=user.id, policy_version="Ley81-2019-v1.0", accepted=accepted)
    if accepted_at is not None:
        record.accepted_at = accepted_at
    db.add(record)
    db.commit()
    return record


def make_zone(
    db: Session,
    slug: str = "zona-test",
    name: str = "Zona Test",
    delivery_fee: float = 1.5,
    distance_km: float = 2.0,
    is_active: bool = True,
) -> Zone:
    zone = Zone(
        slug=slug,
        name=name,
        delivery_fee=delivery_fee,
        distance_km=distance_km,
        is_active=is_active,
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


def make_merchant(
    db: Session,
    code: str = "M-TEST",
    name: str = "Merchant Test",
    zone_slug: str = "zona-test",
    category_type: str = "Restaurante",
    affiliation_status: str = "activo",
    is_open: bool = True,
) -> Merchant:
    merchant = Merchant(
        code=code,
        name=name,
        category_type=category_type,
        zone_slug=zone_slug,
        affiliation_status=affiliation_status,
        is_open=is_open,
    )
    db.add(merchant)
    db.commit()
    db.refresh(merchant)
    return merchant


def make_courier(
    db: Session,
    code: str = "C-TEST",
    name: str = "Courier Test",
    zone_slug: str = "zona-test",
    affiliation_status: str = "activo",
    is_available: bool = True,
) -> Courier:
    courier = Courier(
        code=code,
        name=name,
        zone_slug=zone_slug,
        affiliation_status=affiliation_status,
        is_available=is_available,
    )
    db.add(courier)
    db.commit()
    db.refresh(courier)
    return courier


def make_product(
    db: Session,
    code: str = "P-TEST",
    merchant_code: str = "M-TEST",
    name: str = "Product Test",
    price: float = 5.0,
    promo_price: float | None = None,
    category: str = "General",
    is_available: bool = True,
) -> Product:
    product = Product(
        code=code,
        merchant_code=merchant_code,
        name=name,
        price=price,
        promo_price=promo_price,
        category=category,
        is_available=is_available,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(str(user.id), user.role)
    return {"Authorization": f"Bearer {token}"}


def link_merchant(db: Session, merchant: Merchant, user: User) -> None:
    merchant.owner_user_id = user.id
    db.commit()


def link_courier(db: Session, courier: Courier, user: User) -> None:
    courier.user_id = user.id
    db.commit()


def make_order(
    db: Session,
    code: str,
    customer_id: int,
    merchant_code: str = "M-TEST",
    courier_code: str | None = None,
    status: str = "pendiente",
):
    from app.domains.orders.models import Order

    order = Order(
        code=code,
        merchant_code=merchant_code,
        merchant_name="Merchant",
        customer_id=customer_id,
        customer_name="Customer",
        zone_slug="zona-test",
        delivery_address="Calle 1",
        payment_method="contr_entrega",
        status=status,
        courier_code=courier_code,
        subtotal=10.0,
        delivery_fee=1.5,
        total=11.5,
    )
    db.add(order)
    db.commit()
    return order
