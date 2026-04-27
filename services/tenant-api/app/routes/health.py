"""Health endpoint. No auth, no Supabase call — just a liveness probe."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import CONFIG
from app.schemas import HealthResponse

router = APIRouter()


@router.get('/health', response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        service=CONFIG.service_name,
        supabase_configured=bool(CONFIG.supabase_url and CONFIG.supabase_jwks_url),
    )


@router.get('/')
def root() -> dict[str, str]:
    return {'service': CONFIG.service_name, 'docs': '/docs'}
