"""Runtime configuration for the tenant-api service.

All values come from the environment so the same image runs in dev,
staging, and prod. The service is **the only place** that holds the
Supabase service-role key — agents must never see it.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


def _split_csv(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(',') if item.strip()]


@dataclass(frozen=True)
class Config:
    service_name: str
    port: int
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwks_url: str
    allowed_origins: list[str]
    allowed_origin_regex: str | None


def load_config() -> Config:
    return Config(
        service_name=os.getenv('SERVICE_NAME', 'tenant-api'),
        port=int(os.getenv('PORT', '8060')),
        supabase_url=(os.getenv('SUPABASE_URL') or '').strip(),
        supabase_anon_key=(os.getenv('SUPABASE_ANON_KEY') or '').strip(),
        supabase_service_role_key=(os.getenv('SUPABASE_SERVICE_ROLE_KEY') or '').strip(),
        supabase_jwks_url=(os.getenv('SUPABASE_JWKS_URL') or '').strip(),
        allowed_origins=_split_csv(os.getenv('TENANT_API_ALLOWED_ORIGINS')),
        allowed_origin_regex=(os.getenv('TENANT_API_ALLOWED_ORIGIN_REGEX') or None),
    )


CONFIG = load_config()
