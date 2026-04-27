"""JWT verification and admin-role guard for tenant-api.

This service exposes both customer-scoped routes (members of a brand
managing their own brand) and admin routes (Helio staff managing every
brand). Both authenticate via Supabase-issued JWTs; admins are
distinguished by ``app_metadata.role == 'helio_admin'``.

JWKS is fetched once and cached for an hour. ``PyJWT`` validates the
signature; we additionally check ``iss``, ``aud``, ``exp``, and ``nbf``.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient

from app.config import CONFIG

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AuthPrincipal:
    """The verified caller. ``brand_id`` may be NULL for admins acting globally."""

    user_id: str
    email: str | None
    role: str
    brand_id: str | None


_JWKS_CLIENT: PyJWKClient | None = None
_JWKS_LOADED_AT: float = 0.0
_JWKS_TTL_SECONDS: float = 3600.0


def _jwks_client() -> PyJWKClient:
    """Lazy-init + 1-hour TTL on the JWKS client.

    Supabase rotates JWKS rarely; an hour-stale cache is fine and saves
    a network round-trip on every request.
    """
    global _JWKS_CLIENT, _JWKS_LOADED_AT
    now = time.monotonic()
    if _JWKS_CLIENT is None or now - _JWKS_LOADED_AT > _JWKS_TTL_SECONDS:
        if not CONFIG.supabase_jwks_url:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail='SUPABASE_JWKS_URL not configured.',
            )
        _JWKS_CLIENT = PyJWKClient(CONFIG.supabase_jwks_url, cache_keys=True)
        _JWKS_LOADED_AT = now
    return _JWKS_CLIENT


def _verify_jwt(token: str) -> dict[str, Any]:
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            signing_key,
            algorithms=['RS256', 'ES256'],
            audience='authenticated',
            options={'require': ['exp', 'sub', 'iss']},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Token expired.')
    except jwt.InvalidTokenError as exc:
        logger.warning('JWT validation failed: %s', exc)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid token.') from exc


def require_caller(
    authorization: str | None = Header(default=None),
) -> AuthPrincipal:
    """FastAPI dependency: validate the Bearer JWT, return the principal."""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Missing or malformed Authorization header.',
            headers={'WWW-Authenticate': 'Bearer'},
        )
    token = authorization.removeprefix('Bearer ').strip()
    payload = _verify_jwt(token)
    app_metadata = payload.get('app_metadata') or {}
    return AuthPrincipal(
        user_id=str(payload['sub']),
        email=payload.get('email'),
        role=str(app_metadata.get('role') or 'member'),
        brand_id=app_metadata.get('brand_id'),
    )


def require_admin(principal: AuthPrincipal = Depends(require_caller)) -> AuthPrincipal:
    """Reject the caller unless they hold the ``helio_admin`` role claim."""
    if principal.role != 'helio_admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Admin role required.',
        )
    return principal


# httpx client with the service-role key — used to call Supabase REST
# endpoints with RLS bypass. ``httpx.AsyncClient`` is async-safe and
# reuses connections, so a single instance for the process is correct.
_admin_http: httpx.AsyncClient | None = None


def supabase_admin_client() -> httpx.AsyncClient:
    """Return the lazily-built service-role httpx client.

    Used by tenant-api routes that need to bypass RLS (e.g. inserting a
    brand_members row at the same time as the brand insert). Never expose
    this client outside this service.
    """
    global _admin_http
    if _admin_http is None:
        if not CONFIG.supabase_url or not CONFIG.supabase_service_role_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail='Supabase credentials not configured on server.',
            )
        _admin_http = httpx.AsyncClient(
            base_url=CONFIG.supabase_url,
            headers={
                'apikey': CONFIG.supabase_service_role_key,
                'Authorization': f'Bearer {CONFIG.supabase_service_role_key}',
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
            },
            timeout=httpx.Timeout(10.0),
        )
    return _admin_http
