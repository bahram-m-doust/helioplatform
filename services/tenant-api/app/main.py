"""FastAPI entrypoint for tenant-api.

This service holds Supabase auth state (JWT verification) and the
service-role key. Two route groups:

* ``/me/*``     — caller-scoped, RLS-enforced via the user's own JWT.
* ``/admin/*``  — admin-only, RLS-bypassing via the service role.

Health is unauthenticated.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CONFIG
from app.routes import admin_brands, health, me
from app.routes.admin_brands import framer_router
from app.security import close_supabase_admin_client


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Request-scoped state is per-handler; this hook owns process-wide
    resources only. Today: the service-role httpx client (built lazily on
    first use, closed gracefully on shutdown so SIGTERM doesn't leak open
    sockets).
    """
    try:
        yield
    finally:
        await close_supabase_admin_client()


def create_app() -> FastAPI:
    app = FastAPI(title='Helio tenant-api', lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CONFIG.allowed_origins,
        allow_origin_regex=CONFIG.allowed_origin_regex,
        allow_credentials=False,
        allow_methods=['GET', 'POST', 'OPTIONS'],
        allow_headers=['Content-Type', 'Authorization'],
        max_age=600,
    )

    app.include_router(health.router, tags=['health'])
    app.include_router(me.router)
    app.include_router(admin_brands.router)
    app.include_router(framer_router)
    return app


app = create_app()
