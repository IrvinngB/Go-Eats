from app.core.config import validate_runtime_settings
from app.core.database import Base, SessionLocal, engine
from app.core.migrations import run_startup_migrations
from app.domains.catalog.models import Product  # noqa: F401
from app.domains.delivery.models import Courier  # noqa: F401
from app.domains.merchants.models import Merchant  # noqa: F401
from app.domains.orders.models import Order, OrderItem, OrderRating, OrderStatusHistory  # noqa: F401
from app.domains.payments.models import Payment, PaymentStatusHistory, Receipt  # noqa: F401
from app.domains.users.models import ArcoRequest, DataConsent, User  # noqa: F401
from app.domains.zones.models import Zone  # noqa: F401
from app.shared.audit import AuditLog, AuthEvent, DataAccessLog  # noqa: F401
from app.seed import seed_initial_data


def init() -> None:
    validate_runtime_settings()
    Base.metadata.create_all(bind=engine)
    run_startup_migrations(engine)
    with SessionLocal() as db:
        seed_initial_data(db)


if __name__ == "__main__":
    init()
