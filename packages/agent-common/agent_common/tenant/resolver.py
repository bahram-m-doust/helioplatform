"""``require_tenant`` — the single FastAPI dependency every /v1 route uses.

Replaces ``require_caller`` from Phase 1. The token-bucket rate limit
and security-headers middleware from ``agent_common.security`` stay in
place; this module wires the **identity** half of the auth flow.

Returns a fully-populated :class:`TenantContext`. Two paths:

JWT path
--------

1. Validate the Bearer token against Supabase JWKS (1h cache).
2. Read ``app_metadata.brand_id`` and ``sub``.
3. Confirm membership in ``brand_members`` (60s cache).
4. Optionally cross-check ``Origin`` against ``brand_subdomains``
   — mismatch = 403.

X-API-Key path
--------------

1. SHA-256 the presented secret, look up ``brand_api_keys.key_hash``.
2. Reject if ``revoked_at IS NOT NULL``.
3. Apply per-key token-bucket rate limit (``agent_common.security``).
4. Resolve ``brand_id`` straight from the row.

Either path ends with ``TenantContext``. Audit/quota writes happen in
the route handler with that context as the scope.
"""

from __future__ import annotations

import hashlib
import logging
import os
from collections.abc import Callable

import httpx
from fastapi import Depends, Header, HTTPException, Request, Response, status

from agent_common.external_config import ExternalConfig
from agent_common.security import RateLimiter, build_security
from agent_common.tenant.context import TenantContext
from agent_common.tenant.jwks import verify_supabase_jwt
from agent_common.tenant.members_cache import get_cached_membership, set_cached_membership
from agent_common.tenant.supabase_client import anon_client, jwt_client


# Sentinel used in legacy mode (Supabase not configured). Helper functions
# in ``agent_common.tenant.audit`` short-circuit when they see this value.
LEGACY_BRAND_ID = "00000000-0000-0000-0000-000000000000"


def supabase_configured() -> bool:
    return bool((os.getenv("SUPABASE_URL") or "").strip())

logger = logging.getLogger(__name__)


_SUBDOMAIN_CHECK_DISABLED = os.getenv(
    "HELIO_DISABLE_ORIGIN_SUBDOMAIN_CHECK", ""
).strip().lower() in {"1", "true", "yes"}


async def _confirm_membership(user_id: str, brand_id: str, bearer_token: str) -> str:
    """Confirm the user is a member of the brand. Returns their role.

    Cached for 60s; revocations take effect within that window.
    Raises 403 if not a member.
    """
    cached = get_cached_membership(user_id, brand_id)
    if cached is not None:
        if not cached.valid:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "User is not a member of this brand.")
        return cached.role

    client = jwt_client()
    try:
        response = await client.get(
            "/rest/v1/brand_members",
            params={
                "select": "role",
                "user_id": f"eq.{user_id}",
                "brand_id": f"eq.{brand_id}",
                "limit": "1",
            },
            headers={"Authorization": f"Bearer {bearer_token}"},
        )
    except httpx.HTTPError as exc:
        logger.warning("Membership lookup failed: %s", exc)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Tenant directory unavailable."
        ) from exc

    if response.status_code >= 400:
        logger.warning("Membership lookup returned %s: %s", response.status_code, response.text[:200])
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Tenant directory unavailable.")

    rows = response.json() or []
    if not rows:
        set_cached_membership(user_id, brand_id, valid=False, role="")
        raise HTTPException(status.HTTP_403_FORBIDDEN, "User is not a member of this brand.")

    role = str(rows[0].get("role") or "member")
    set_cached_membership(user_id, brand_id, valid=True, role=role)
    return role


async def _resolve_brand_slug(brand_id: str, bearer_token: str) -> str:
    """Best-effort fetch of the brand slug. Empty string on miss."""
    client = jwt_client()
    try:
        response = await client.get(
            "/rest/v1/brands",
            params={"select": "slug", "id": f"eq.{brand_id}", "limit": "1"},
            headers={"Authorization": f"Bearer {bearer_token}"},
        )
    except httpx.HTTPError:
        return ""
    if response.status_code >= 400:
        return ""
    rows = response.json() or []
    return str(rows[0].get("slug") or "") if rows else ""


def _extract_origin_subdomain(origin: str | None) -> str | None:
    """``https://binghatti.platform.helio.ae`` -> ``"binghatti"``. ``None`` if not a brand subdomain."""
    if not origin:
        return None
    cleaned = origin.lower().removeprefix("https://").removeprefix("http://")
    cleaned = cleaned.split("/", 1)[0].split(":", 1)[0]
    suffix = ".platform.helio.ae"
    if not cleaned.endswith(suffix):
        return None
    label = cleaned.removesuffix(suffix)
    return label or None


async def _confirm_subdomain_matches(brand_id: str, origin: str | None) -> None:
    """Defense in depth: if ``Origin`` is a brand subdomain, it must map to the same brand."""
    if _SUBDOMAIN_CHECK_DISABLED:
        return
    subdomain = _extract_origin_subdomain(origin)
    if subdomain is None:
        return  # Non-browser caller or non-brand origin (e.g. admin.helio.ae).
    client = anon_client()
    try:
        response = await client.get(
            "/rest/v1/brand_subdomains",
            params={"select": "brand_id", "subdomain": f"eq.{subdomain}", "limit": "1"},
        )
    except httpx.HTTPError as exc:
        logger.warning("Subdomain lookup failed: %s", exc)
        # Fail open on lookup error — JWT claim still authoritative.
        return
    if response.status_code >= 400:
        return
    rows = response.json() or []
    if not rows:
        # Subdomain has no record. Treat as misrouted request.
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Origin subdomain is not registered.",
        )
    expected_brand_id = str(rows[0].get("brand_id") or "")
    if expected_brand_id != brand_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Origin subdomain does not match JWT brand.",
        )


async def _resolve_via_api_key(secret: str, config: ExternalConfig) -> tuple[str, str, str]:
    """Look up the API-key hash. Returns ``(brand_id, brand_slug, api_key_id)``.

    Uses the anon client + service-role-bypass-via-RPC pattern? No — keys
    are SELECT-RLS-protected to brand members, but the agent doesn't have
    a member context. We fall back to a Postgres SECURITY DEFINER RPC
    (``public.resolve_brand_api_key``) shipped with the schema; the
    function's owner has service-role privileges, the caller (anon) does
    not. The function returns at most one row keyed on the SHA-256 hash.

    Returns ``(brand_id, brand_slug, api_key_id)`` or raises 401.
    """
    key_hash_hex = hashlib.sha256(secret.encode("utf-8")).hexdigest()
    client = anon_client()
    try:
        response = await client.post(
            "/rest/v1/rpc/resolve_brand_api_key",
            json={"key_hash_hex": key_hash_hex},
        )
    except httpx.HTTPError as exc:
        logger.warning("API key lookup failed: %s", exc)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Tenant directory unavailable."
        ) from exc

    if response.status_code >= 400:
        logger.warning("API key RPC returned %s: %s", response.status_code, response.text[:200])
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Tenant directory unavailable.")

    payload = response.json() or []
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
            headers={"WWW-Authenticate": 'ApiKey realm="helio-external"'},
        )
    row = payload[0] if isinstance(payload, list) else payload
    return (
        str(row["brand_id"]),
        str(row.get("brand_slug") or ""),
        str(row["api_key_id"]),
    )


def build_tenant_resolver(
    *,
    config: ExternalConfig,
) -> Callable[..., object]:
    """Build the ``require_tenant`` FastAPI dependency for one agent.

    Each agent calls this once at module load time. The returned callable
    is what route handlers ``Depends(...)`` on. A per-agent
    ``RateLimiter`` is instantiated here so the X-API-Key bucket is
    scoped to one agent's process.

    **Backwards-compatible fallback.** If ``SUPABASE_URL`` is unset (the
    operator hasn't migrated to the multi-tenant control plane yet), the
    resolver falls back to the legacy env-var key flow from
    ``agent_common.security.build_security``. Returned ``TenantContext``
    has ``brand_id = LEGACY_BRAND_ID``; the audit / quota / per-brand
    config helpers detect this sentinel and silently no-op. Once the
    operator sets ``SUPABASE_URL`` and runs the one-time key migration,
    every request automatically flips to the full multi-tenant path on
    the next deploy.
    """

    if not supabase_configured():
        return _build_legacy_resolver(config)

    limiter = RateLimiter(
        per_minute=config.rate_limit_per_minute,
        burst=config.rate_limit_burst,
    )

    async def require_tenant(
        request: Request,
        response: Response,
        authorization: str | None = Header(default=None),
        x_api_key: str | None = Header(default=None, alias="X-API-Key"),
        origin: str | None = Header(default=None),
    ) -> TenantContext:
        # ---- JWT path ----
        if authorization and authorization.lower().startswith("bearer "):
            token = authorization.split(" ", 1)[1].strip()
            claims = verify_supabase_jwt(token)
            user_id = str(claims.get("sub") or "")
            app_metadata = claims.get("app_metadata") or {}
            brand_id = str(app_metadata.get("brand_id") or "")
            if not brand_id:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "JWT has no app_metadata.brand_id; current brand not selected.",
                )
            role = await _confirm_membership(user_id, brand_id, token)
            await _confirm_subdomain_matches(brand_id, origin)
            brand_slug = await _resolve_brand_slug(brand_id, token)
            response.headers["X-RateLimit-Scope"] = "user"
            return TenantContext(
                brand_id=brand_id,
                brand_slug=brand_slug,
                user_id=user_id,
                api_key_id=None,
                auth_method="jwt",
                bearer_token=token,
                role=str(app_metadata.get("role") or "member"),
            )

        # ---- X-API-Key path ----
        if x_api_key:
            secret = x_api_key.strip()
            if not secret:
                raise HTTPException(
                    status.HTTP_401_UNAUTHORIZED,
                    "Empty X-API-Key.",
                    headers={"WWW-Authenticate": 'ApiKey realm="helio-external"'},
                )
            brand_id, brand_slug, api_key_id = await _resolve_via_api_key(secret, config)
            allowed, retry_after = limiter.check(api_key_id)
            if not allowed:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded. Please retry after a moment.",
                    headers={"Retry-After": str(int(retry_after) + 1)},
                )
            response.headers["X-RateLimit-Limit"] = str(config.rate_limit_per_minute)
            response.headers["X-RateLimit-Scope"] = "api-key"
            return TenantContext(
                brand_id=brand_id,
                brand_slug=brand_slug,
                user_id=None,
                api_key_id=api_key_id,
                auth_method="api_key",
                bearer_token=None,
                role="member",
            )

        # ---- No credentials ----
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization or X-API-Key.",
            headers={"WWW-Authenticate": 'Bearer, ApiKey realm="helio-external"'},
        )

    return require_tenant


def _build_legacy_resolver(config: ExternalConfig) -> Callable[..., object]:
    """Backwards-compatible env-var-key resolver.

    Activated when ``SUPABASE_URL`` is unset. Wraps the Phase-1
    ``build_security`` flow so X-API-Key + token-bucket continues to
    work exactly as before this commit. Returns a synthetic
    ``TenantContext`` with ``brand_id = LEGACY_BRAND_ID``; downstream
    audit / quota / per-brand-config helpers detect the sentinel and
    no-op so route handlers don't need conditional logic.

    JWT requests are rejected in legacy mode — there's no Supabase to
    validate them against — with a clear 503 telling the caller the
    deployment hasn't enabled JWT auth yet.
    """
    bundle = build_security(config)

    async def require_tenant_legacy(
        response: Response,
        authorization: str | None = Header(default=None),
        x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    ) -> TenantContext:
        if authorization and authorization.lower().startswith("bearer "):
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "JWT auth is not configured on this deployment. Use X-API-Key.",
            )
        # Reuse the legacy bundle: env-var key validation + per-key bucket.
        principal = bundle.api_key_principal(x_api_key=x_api_key)
        # Re-apply the rate-limit + headers the legacy bundle would have set.
        bundle.require_caller(response=response, principal=principal)
        return TenantContext(
            brand_id=LEGACY_BRAND_ID,
            brand_slug="legacy",
            user_id=None,
            api_key_id=None,
            auth_method="api_key",
            bearer_token=None,
            role="member",
        )

    return require_tenant_legacy
