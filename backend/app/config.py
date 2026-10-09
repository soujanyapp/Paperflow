from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: str = Field("development", alias="PAPERFLOW_ENV")
    database_url: str = Field(
        "postgresql+psycopg://paperflow:paperflow_dev@localhost:5432/paperflow",
        alias="DATABASE_URL",
    )
    secret_key: str = Field("dev-only-secret-change-me", alias="SECRET_KEY")
    access_token_expire_minutes: int = Field(10080, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    cors_origins: str = Field("http://localhost:5173", alias="CORS_ORIGINS")

    storage_root: str = Field("./storage", alias="STORAGE_ROOT")
    max_upload_mb: int = Field(15, alias="MAX_UPLOAD_MB")
    pdf_export_timeout_ms: int = Field(45000, alias="PDF_EXPORT_TIMEOUT_MS")

    @field_validator("secret_key")
    @classmethod
    def _guard_secret(cls, value: str, info) -> str:
        env = (info.data.get("env") or "development").lower()
        if env == "production" and (len(value) < 32 or "change" in value or "dev-only" in value):
            raise ValueError("SECRET_KEY must be a strong, unique value in production")
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
