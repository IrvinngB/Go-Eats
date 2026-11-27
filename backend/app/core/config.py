import os
from collections.abc import Mapping
from pydantic import BaseModel

# Local-only fallback. Production must inject its own secret (see validate_runtime_settings).
DEFAULT_JWT_SECRET = "dev-secret-key-change-in-prod-goeats"


def env_flag(value: str | None) -> bool:
    """True only for 1/true/yes (case-insensitive); anything else is OFF."""
    return (value or "").strip().lower() in {"1", "true", "yes"}


def normalize_db_url(url: str) -> str:
    """Render/Heroku dan `postgres://` o `postgresql://`; SQLAlchemy necesita el driver psycopg 3."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


class Settings(BaseModel):
    app_name: str = "Go Eats API"
    api_v1_prefix: str = "/api/v1"
    database_url: str = normalize_db_url(os.getenv("DATABASE_URL", "sqlite:///./goeats.db"))
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", DEFAULT_JWT_SECRET)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    privacy_policy_version: str = "Ley81-2019-v1.0"
    s3_endpoint_url: str = os.getenv("S3_ENDPOINT_URL", "http://localhost:9000")
    s3_access_key: str = os.getenv("S3_ACCESS_KEY", "minioadmin")
    s3_secret_key: str = os.getenv("S3_SECRET_KEY", "minioadmin_password")
    s3_bucket_name: str = os.getenv("S3_BUCKET_NAME", "goeats-storage")
    # Server-side dev flags: read from the environment only, never from a request.
    dev_role_override: bool = env_flag(os.getenv("DEV_ROLE_OVERRIDE"))
    dev_simulate_failure: bool = env_flag(os.getenv("DEV_SIMULATE_FAILURE"))


settings = Settings()


def is_production(environ: Mapping[str, str]) -> bool:
    """Render sets RENDER=true on every service; APP_ENV=production covers other hosts."""
    return env_flag(environ.get("RENDER")) or environ.get("APP_ENV", "").lower() == "production"


def validate_runtime_settings(environ: Mapping[str, str] | None = None) -> None:
    """Fail fast instead of signing production tokens with the public, hard-coded secret."""
    environ = os.environ if environ is None else environ
    if not is_production(environ):
        return
    secret = (environ.get("JWT_SECRET_KEY") or "").strip()
    if not secret or secret == DEFAULT_JWT_SECRET:
        raise RuntimeError("JWT_SECRET_KEY must be set to a private value in production.")
