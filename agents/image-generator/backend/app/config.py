import os


def _split_csv(name: str) -> list[str]:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return []
    return [chunk.strip() for chunk in raw.split(",") if chunk.strip()]


SERVICE_NAME = os.getenv("SERVICE_NAME", "image-generator")
PORT = int(os.getenv("PORT", "8020"))

# Comma-separated origins, e.g. "https://platform.helio.ae,https://framer.com"
# Empty → allow any origin (*). Paths are not part of Origin; one entry covers all paths on that host.
CORS_ALLOW_ORIGINS = _split_csv("CORS_ALLOW_ORIGINS")
