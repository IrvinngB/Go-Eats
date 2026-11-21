from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.domains.auth.router import router as auth_router
from app.domains.catalog.router import router as catalog_router
from app.domains.delivery.router import router as delivery_router
from app.domains.merchants.router import router as merchants_router
from app.domains.orders.router import router as orders_router
from app.domains.payments.router import router as payments_router
from app.domains.reports.router import router as reports_router
from app.domains.users.router import router as users_router
from app.domains.zones.router import router as zones_router
from app.seed import seed_initial_data


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_initial_data(db)
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Monolito modular de 9 dominios para Go Eats — Comercios Unidos del Istmo, S.A.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for domain_router in (
    auth_router,
    users_router,
    zones_router,
    merchants_router,
    catalog_router,
    delivery_router,
    orders_router,
    payments_router,
    reports_router,
):
    app.include_router(domain_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}
