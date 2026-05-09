from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, image
from app.config import CORS_ALLOW_ORIGINS, SERVICE_NAME


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    yield


def create_app() -> FastAPI:
    application = FastAPI(title=f"Helio {SERVICE_NAME}", lifespan=lifespan)
    # Wildcard origin cannot be combined with credentials in browsers; use explicit origins if you need cookies.
    cors_origins = CORS_ALLOW_ORIGINS if CORS_ALLOW_ORIGINS else ["*"]
    cors_credentials = bool(CORS_ALLOW_ORIGINS)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=cors_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(health.router, tags=["health"])
    application.include_router(image.router)
    return application


app = create_app()
