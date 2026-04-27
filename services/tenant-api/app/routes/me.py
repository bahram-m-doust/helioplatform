"""``/me`` endpoints — caller-scoped queries.

Forwards the caller's Bearer JWT to Supabase so PostgREST applies the
RLS policies as the user. Service role is never used on this path.
"""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.config import CONFIG
from app.schemas import MembershipRead, UsageRow
from app.security import AuthPrincipal, require_caller

router = APIRouter(prefix='/me', tags=['me'])


def _bearer(request: Request) -> str:
    raw = request.headers.get('authorization') or ''
    if not raw.lower().startswith('bearer '):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Missing Bearer token.')
    return raw.removeprefix('Bearer ').removeprefix('bearer ').strip()


@router.get('/brands', response_model=list[MembershipRead])
async def list_my_brands(
    request: Request,
    _principal: AuthPrincipal = Depends(require_caller),
) -> list[MembershipRead]:
    """Return the brands the caller is a member of (RLS-scoped to them)."""
    if not CONFIG.supabase_url or not CONFIG.supabase_anon_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, 'Supabase not configured.')

    token = _bearer(request)
    headers = {
        'apikey': CONFIG.supabase_anon_key,
        'Authorization': f'Bearer {token}',
    }
    async with httpx.AsyncClient(base_url=CONFIG.supabase_url, timeout=10.0) as client:
        response = await client.get(
            '/rest/v1/brand_members',
            params={'select': 'role,brand:brands(id,slug,display_name)'},
            headers=headers,
        )
    if response.status_code >= 400:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, 'Supabase query failed.')
    rows = response.json()
    return [
        MembershipRead(
            brand_id=row['brand']['id'],
            slug=row['brand']['slug'],
            display_name=row['brand']['display_name'],
            role=row['role'],
        )
        for row in rows
        if row.get('brand')
    ]


@router.get('/usage', response_model=list[UsageRow])
async def list_my_usage(
    request: Request,
    _principal: AuthPrincipal = Depends(require_caller),
) -> list[UsageRow]:
    """Return per-brand cost rollups the caller is allowed to see.

    Reads the ``brand_cost_summary`` view (RLS-aware via
    security_invoker=true). One row per (brand, agent_kind, month).
    The admin UI's Usage page renders these directly.
    """
    if not CONFIG.supabase_url or not CONFIG.supabase_anon_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, 'Supabase not configured.')

    token = _bearer(request)
    headers = {
        'apikey': CONFIG.supabase_anon_key,
        'Authorization': f'Bearer {token}',
    }
    async with httpx.AsyncClient(base_url=CONFIG.supabase_url, timeout=10.0) as client:
        response = await client.get(
            '/rest/v1/brand_cost_summary',
            params={
                'select': 'brand_id,agent_kind,period_start,succeeded_count,failed_count,total_cost_usd,avg_duration_ms,last_run_at',
                'order': 'period_start.desc,total_cost_usd.desc',
            },
            headers=headers,
        )
    if response.status_code >= 400:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, 'Supabase query failed.')
    rows = response.json() or []
    return [UsageRow(**row) for row in rows]
