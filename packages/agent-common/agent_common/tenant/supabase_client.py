"""Helpers for talking to Supabase from inside an agent process.

Two distinct flows:

* ``query_with_jwt`` — call PostgREST with the user's bearer token. RLS
  scopes the answer to whatever the user is allowed to see. Used by
  the JWT path.

* ``query_with_anon`` — call PostgREST with the anon key + an explicit
  ``brand_id`` filter. Used by the X-API-Key path, where there's no
  user JWT so RLS would deny everything; the explicit filter takes RLS's
  place. The agent MUST always pass the ``brand_id`` arg.

Agents NEVER hold the service-role key. Audit writes (which need to
bypass RLS) go through the ``audit_via_rpc`` helper that calls a
``security definer`` Postgres function — the function's owner has
service-role privileges; the caller doesn't.
"""

from __future__ import annotations

import os

import httpx
from fastapi import HTTPException, status

# Module-level connection pool. httpx.AsyncClient is async-safe and reuses
# connections, so a single instance per process is correct.
_jwt_client: httpx.AsyncClient | None = None
_anon_client: httpx.AsyncClient | None = None


def _supabase_url() -> str:
    url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
    if not url:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "SUPABASE_URL not configured.",
        )
    return url


def _supabase_anon_key() -> str:
    key = (os.getenv("SUPABASE_ANON_KEY") or "").strip()
    if not key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "SUPABASE_ANON_KEY not configured.",
        )
    return key


def _build_jwt_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=_supabase_url(),
        headers={"apikey": _supabase_anon_key()},
        timeout=httpx.Timeout(10.0),
    )


def _build_anon_client() -> httpx.AsyncClient:
    key = _supabase_anon_key()
    return httpx.AsyncClient(
        base_url=_supabase_url(),
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
        },
        timeout=httpx.Timeout(10.0),
    )


def jwt_client() -> httpx.AsyncClient:
    """Singleton client for JWT-authenticated PostgREST calls.

    The Authorization header is added per-call (different per user).
    """
    global _jwt_client
    if _jwt_client is None:
        _jwt_client = _build_jwt_client()
    return _jwt_client


def anon_client() -> httpx.AsyncClient:
    """Singleton client for anon-key PostgREST calls (X-API-Key path)."""
    global _anon_client
    if _anon_client is None:
        _anon_client = _build_anon_client()
    return _anon_client
