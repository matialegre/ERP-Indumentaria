"""
Configuración central del ERP — cargada desde .env
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── Base de datos ──
    DATABASE_URL: str

    # ── JWT ──
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 horas

    # ── CORS — acepta cualquier origen (ERP interno de red local)
    CORS_ALLOWED_ORIGINS: str = "*"

    # ── Admin inicial ──
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "MundoAdmin2026!"

    # ── Redis ──
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── IA — Chat de mejoras (OpenAI) ──
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    AUTOMATOR_SECRET: str = ""

    # ── CRM — VTEX ──
    CRM_VTEX_ACCOUNT: str = ""
    CRM_VTEX_ENV: str = "vtexcommercestable"
    CRM_VTEX_APP_KEY: str = ""
    CRM_VTEX_APP_TOKEN: str = ""

    # ── CRM — OpenRouter (AI Chatbot) ──
    CRM_OPENROUTER_API_KEY: str = ""
    CRM_OPENROUTER_MODEL: str = "openai/gpt-4o-mini"

    # ── CRM — Dragonfish ──
    CRM_DRAGONFISH_BASE_URL: str = ""
    CRM_DRAGONFISH_API_KEY: str = ""
    CRM_DRAGONFISH_ID_CLIENTE: str = ""
    CRM_DRAGONFISH_AUTHORIZATION: str = ""
    CRM_DRAGONFISH_BASE_DE_DATOS: str = ""

    # ── CRM — MercadoLibre token paths ──
    CRM_ML_TOKEN_DIR: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ALLOWED_ORIGINS.split(",")]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
