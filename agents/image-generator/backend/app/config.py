import os
from urllib.parse import urlparse


def _csv(value: str) -> list[str]:
    return [item.strip().rstrip("/") for item in value.split(",") if item.strip()]


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _origin(value: str) -> str:
    parsed = urlparse(value.strip())
    if not parsed.scheme or not parsed.netloc:
        return ""
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}".rstrip("/")

SERVICE_NAME = os.getenv("SERVICE_NAME", "image-generator")
PORT = int(os.getenv("PORT", "8020"))
DEBUG = os.getenv("DEBUG", "False").strip().lower() in {"1", "true", "yes", "on"}
FRAMER_IMAGE_API_TOKEN = os.getenv("FRAMER_IMAGE_API_TOKEN", "").strip()
FRAMER_IMAGE_ALLOWED_ORIGINS = _csv(
    os.getenv("FRAMER_IMAGE_ALLOWED_ORIGINS", "https://octara.framer.website")
)
FRAMER_IMAGE_RATE_LIMIT_PER_MINUTE = _int_env("FRAMER_IMAGE_RATE_LIMIT_PER_MINUTE", 6)
FRAMER_IMAGE_MAX_PROMPT_CHARS = _int_env("FRAMER_IMAGE_MAX_PROMPT_CHARS", 1500)
FRAMER_IMAGE_MAX_REFERENCE_IMAGES = _int_env("FRAMER_IMAGE_MAX_REFERENCE_IMAGES", 0)

AGENT_CORS_ALLOWED_ORIGINS = _csv(os.getenv("AGENT_CORS_ALLOWED_ORIGINS", ""))
if not AGENT_CORS_ALLOWED_ORIGINS:
    public_origins = [
        _origin(os.getenv("FRONTEND_URL", "")),
        _origin(os.getenv("PUBLIC_URL", "")),
    ]
    AGENT_CORS_ALLOWED_ORIGINS = [
        "http://localhost:4000",
        "http://localhost:5173",
        "http://localhost:5174",
        *[origin for origin in public_origins if origin],
        *FRAMER_IMAGE_ALLOWED_ORIGINS,
    ]
