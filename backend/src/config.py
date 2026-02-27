"""Application settings from environment variables."""

from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Load from env and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "yarok"
    debug: bool = False

    # Database (PostgreSQL + PostGIS)
    database_url: str = "postgresql+asyncpg://localhost/yarok"

    # Redis (for arq)
    redis_url: str = "redis://localhost:6379/0"

    # JWT (RS256: private key for signing, public for verify)
    jwt_private_key_pem: str = ""
    jwt_public_key_pem: str = ""
    jwt_access_exp_minutes: int = 15
    jwt_refresh_exp_days: int = 30

    # Field-level encryption (Fernet key, base64)
    encryption_key: str = ""

    # S3-compatible storage
    s3_endpoint_url: Optional[str] = None
    s3_bucket: str = "yarok-media"
    s3_region: str = "us-east-1"
    s3_access_key: str = ""
    s3_secret_key: str = ""

    # Local media storage (used when S3 is not configured)
    media_upload_dir: str = "uploads"

    # Expo Push
    expo_push_url: str = "https://exp.host/--/api/v2/push/send"

    # Rate limits
    rate_limit_reports_per_hour: int = 10
    rate_limit_reads_per_minute: int = 100
    rate_limit_auth_per_minute: int = 20
    rate_limit_geocode_per_minute: int = 60
    rate_limit_debug_per_minute: int = 60

    # CORS: comma-separated or JSON list of allowed origins. Defaults to "*" for dev.
    # In production set e.g. CORS_ORIGINS='["https://myapp.com"]'
    cors_origins: list[str] = ["*"]

    # Debug: accept client logs and write to stdout (for Railway / production debugging)
    debug_client_logs: bool = False

    # Admin: secret for admin endpoints (e.g. purge). When set, send X-Admin-Secret.
    admin_secret: Optional[str] = None

    # Password reset (forgot password) email
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@yarok.app"
    smtp_use_tls: bool = True
    # Base URL for reset link (e.g. https://myapp.com or expo web URL).
    # Link will be {base}/auth/reset-password?token=...
    password_reset_base_url: str = ""


settings = Settings()
