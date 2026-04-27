"""JWKS-cached JWT verifier shared by every agent.

Supabase rotates JWKS rarely; an hour-stale cache is fine and saves a
network round-trip on every request.

The expected ``iss`` is derived from ``SUPABASE_URL`` so the operator
cannot accidentally desynchronise it from the JWKS URL — both come from
the same Supabase project.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any

import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient

logger = logging.getLogger(__name__)

_JWKS_TTL_SECONDS: float = 3600.0

# Module-level cache. Locked because uvicorn workers share the process.
_jwks_lock = threading.Lock()
_jwks_client: PyJWKClient | None = None
_jwks_loaded_at: float = 0.0


def _supabase_url() -> str:
    return (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")


def _jwks_url() -> str:
    return (os.getenv("SUPABASE_JWKS_URL") or "").strip()


def _expected_issuer() -> str:
    base = _supabase_url()
    if not base:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_URL not configured.",
        )
    return f"{base}/auth/v1"


def _get_jwks_client() -> PyJWKClient:
    """Lazy-init + 1-hour TTL on the JWKS client."""
    global _jwks_client, _jwks_loaded_at
    now = time.monotonic()
    with _jwks_lock:
        if _jwks_client is None or now - _jwks_loaded_at > _JWKS_TTL_SECONDS:
            url = _jwks_url()
            if not url:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="SUPABASE_JWKS_URL not configured.",
                )
            _jwks_client = PyJWKClient(url, cache_keys=True)
            _jwks_loaded_at = now
        return _jwks_client


def verify_supabase_jwt(token: str) -> dict[str, Any]:
    """Verify a Supabase JWT and return its claims.

    Raises ``HTTPException(401)`` for any verification failure.
    """
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            signing_key,
            algorithms=["RS256", "ES256"],
            audience="authenticated",
            issuer=_expected_issuer(),
            options={"require": ["exp", "sub", "iss"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired.")
    except jwt.InvalidIssuerError:
        logger.warning("JWT issuer mismatch.")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token issuer.")
    except jwt.InvalidTokenError as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token.") from exc
