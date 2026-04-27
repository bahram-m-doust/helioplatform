"""Quota / audit / per-brand-config helpers wrapping the Supabase RPCs.

All three RPCs are SECURITY DEFINER (defined in
``infra/supabase/migrations/0004_rpc.sql``) so the agent can call them
via the anon role without holding the service-role key.

Best-effort semantics: if a write fails (network, RLS, schema drift),
we log loudly but never bubble the error to the customer. The
generation succeeded; we don't want a flaky audit pipeline to surface
as a 5xx.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import HTTPException, status

from agent_common.tenant.context import TenantContext
from agent_common.tenant.resolver import LEGACY_BRAND_ID, supabase_configured
from agent_common.tenant.supabase_client import anon_client

logger = logging.getLogger(__name__)


async def get_brand_agent_config(
    *,
    brand_id: str,
    agent_kind: str,
) -> dict[str, Any] | None:
    """Return the per-brand override config_json, or ``None`` if not published.

    A ``None`` return = the agent is not enabled+published for this
    brand. Route handlers turn that into a 403.

    Legacy mode (Supabase not configured) returns an empty dict so the
    route falls through to the default static prompt without 403'ing.
    """
    if brand_id == LEGACY_BRAND_ID or not supabase_configured():
        return {}

    client = anon_client()
    try:
        response = await client.post(
            "/rest/v1/rpc/get_brand_agent_config",
            json={"p_brand_id": brand_id, "p_agent_kind": agent_kind},
        )
    except httpx.HTTPError as exc:
        logger.warning("get_brand_agent_config RPC failed: %s", exc)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Tenant directory unavailable."
        ) from exc

    if response.status_code >= 400:
        logger.warning("get_brand_agent_config RPC %s: %s", response.status_code, response.text[:200])
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Tenant directory unavailable.")

    payload = response.json()
    # PostgREST returns the scalar function result directly.
    if payload is None:
        return None
    if isinstance(payload, dict):
        return payload
    return None


async def consume_quota(
    *,
    brand_id: str,
    agent_kind: str,
    cost_cents: int,
) -> bool:
    """Atomically debit ``cost_cents`` from ``brand_quotas``. Returns False if blocked.

    Legacy mode (Supabase not configured) always returns ``True`` —
    there's no DB-backed quota to enforce yet, so we let the call
    through and rely on the per-key rate limit for rough capacity
    control.
    """
    if brand_id == LEGACY_BRAND_ID or not supabase_configured():
        return True

    client = anon_client()
    try:
        response = await client.post(
            "/rest/v1/rpc/consume_brand_quota",
            json={
                "p_brand_id": brand_id,
                "p_agent_kind": agent_kind,
                "p_cost_cents": cost_cents,
            },
        )
    except httpx.HTTPError as exc:
        logger.warning("consume_brand_quota RPC failed: %s", exc)
        # Fail closed for safety: a flaky quota DB shouldn't unblock spend.
        return False

    if response.status_code >= 400:
        logger.warning("consume_brand_quota RPC %s: %s", response.status_code, response.text[:200])
        return False

    return bool(response.json())


async def record_run(
    *,
    tenant: TenantContext,
    agent_kind: str,
    status_value: str,  # 'queued' | 'running' | 'succeeded' | 'failed'
    request_payload: dict | None = None,
    response_payload: dict | None = None,
    cost_usd: float | None = None,
    duration_ms: int | None = None,
    error_code: str | None = None,
) -> None:
    """Append one row to ``agent_runs``. Best-effort; never raises.

    Legacy mode (Supabase not configured) silently skips the audit write.
    Operators can backfill once they migrate to multi-tenant.
    """
    if tenant.brand_id == LEGACY_BRAND_ID or not supabase_configured():
        return

    client = anon_client()
    try:
        response = await client.post(
            "/rest/v1/rpc/record_agent_run",
            json={
                "p_brand_id": tenant.brand_id,
                "p_user_id": tenant.user_id,
                "p_api_key_id": tenant.api_key_id,
                "p_agent_kind": agent_kind,
                "p_status": status_value,
                "p_request_payload": request_payload or {},
                "p_response_payload": response_payload,
                "p_cost_usd": cost_usd,
                "p_duration_ms": duration_ms,
                "p_error_code": error_code,
            },
        )
    except httpx.HTTPError as exc:
        logger.warning("record_agent_run RPC failed: %s", exc)
        return
    if response.status_code >= 400:
        logger.warning("record_agent_run RPC %s: %s", response.status_code, response.text[:200])
