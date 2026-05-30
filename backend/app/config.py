import os
from functools import lru_cache


def expand_loopback_origins(raw_origins: str) -> list[str]:
    origins: list[str] = []
    for item in raw_origins.split(","):
        origin = item.strip()
        if not origin or origin in origins:
            continue
        origins.append(origin)

        paired_origin = ""
        if "://localhost:" in origin:
            paired_origin = origin.replace("://localhost:", "://127.0.0.1:")
        elif "://127.0.0.1:" in origin:
            paired_origin = origin.replace("://127.0.0.1:", "://localhost:")
        if paired_origin and paired_origin not in origins:
            origins.append(paired_origin)
    return origins


class Settings:
    default_cors_origins = ",".join(
        [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )

    app_password: str = os.getenv("APP_PASSWORD", "jump2026")
    jwt_secret: str = os.getenv("JWT_SECRET", "please-change-this-secret")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./data/jump_course.sqlite3")
    cors_origins: list[str] = expand_loopback_origins(os.getenv("CORS_ORIGINS", default_cors_origins))


@lru_cache
def get_settings() -> Settings:
    return Settings()
