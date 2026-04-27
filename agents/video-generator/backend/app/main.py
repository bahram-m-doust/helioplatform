from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, video
from app.config import SERVICE_NAME
from app.external import ExternalSecurityHeadersMiddleware, external_router
from app.external.config import CONFIG as EXTERNAL_CONFIG


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Process-wide resource lifecycle. Today: close the cached httpx
    clients used by ``agent_common.tenant.supabase_client`` on shutdown
    so SIGTERM doesn't leak open sockets.
    """
    from agent_common.tenant.supabase_client import aclose_all
    try:
        yield
    finally:
        await aclose_all()


def create_app() -> FastAPI:
    application = FastAPI(title=f"Helio {SERVICE_NAME}", lifespan=lifespan)

    application.add_middleware(ExternalSecurityHeadersMiddleware)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=EXTERNAL_CONFIG.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-API-Key"],
        max_age=600,
    )

    application.include_router(health.router, tags=["health"])
    application.include_router(video.router)
    application.include_router(external_router)
    return application


app = create_app()
