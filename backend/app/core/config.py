import os
from pydantic import BaseModel


def env_flag(value: str | None) -> bool:
    """True only for 1/true/yes (case-insensitive); anything else is OFF."""
    return (value or "").strip().lower() in {"1", "true", "yes"}


class Settings(BaseModel):
    app_name: str = "Go Eats API"
    api_v1_prefix: str = "/api/v1"
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./goeats.db")
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-in-prod-goeats")
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
