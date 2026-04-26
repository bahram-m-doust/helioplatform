"""Security primitives for the external storyteller API."""

from __future__ import annotations

import secrets
import threading
import time

from fastapi import Depends, Header, HTTPException, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

from app.external.config import CONFIG, ExternalConfig


def _resolve_principal(presented: str, config: ExternalConfig) -> str | None:
    presented_bytes = presented.encode("utf-8")
    matched_label: str | None = None
    for label, secret in config.api_keys.items():
        secret_bytes = secret.encode("utf-8")
        if secrets.compare_digest(presented_bytes, secret_bytes):
            matched_label = label
    return matched_label


def api_key_principal(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> str:
    if not CONFIG.enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="External API is not configured on this deployment.",
        )
    presented = (x_api_key or "").strip()
    if not presented:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header.",
            headers={"WWW-Authenticate": 'ApiKey realm="helio-external"'},
        )
    label = _resolve_principal(presented, CONFIG)
    if label is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
            headers={"WWW-Authenticate": 'ApiKey realm="helio-external"'},
        )
    return label


class RateLimiter:
    def __init__(self, *, per_minute: int, burst: int) -> None:
        self._refill_per_second = max(per_minute, 1) / 60.0
        self._capacity = float(max(burst, 1))
        self._buckets: dict[str, tuple[float, float]] = {}
        self._lock = threading.Lock()

    def check(self, principal: str) -> tuple[bool, float]:
        now = time.monotonic()
        with self._lock:
            tokens, last = self._buckets.get(principal, (self._capacity, now))
            tokens = min(self._capacity, tokens + (now - last) * self._refill_per_second)
            if tokens >= 1.0:
                self._buckets[principal] = (tokens - 1.0, now)
                return True, 0.0
            self._buckets[principal] = (tokens, now)
            retry = (1.0 - tokens) / self._refill_per_second
            return False, max(retry, 0.05)


_RATE_LIMITER = RateLimiter(
    per_minute=CONFIG.rate_limit_per_minute,
    burst=CONFIG.rate_limit_burst,
)


_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "interest-cohort=()",
    "Cache-Control": "no-store",
}


class ExternalSecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Apply security headers to every /v1/* response, including error ones.

    Dependency-scoped header writes don't survive ``HTTPException`` — FastAPI
    builds a fresh response from the exception, so headers set on the
    injected ``Response`` object are dropped on the error path. A middleware
    runs after the response is built, so it covers both success and error.
    """

    async def dispatch(self, request: StarletteRequest, call_next):  # type: ignore[override]
        response = await call_next(request)
        if request.url.path.startswith("/v1"):
            for name, value in _SECURITY_HEADERS.items():
                response.headers.setdefault(name, value)
        return response


def require_caller(
    response: Response,
    principal: str = Depends(api_key_principal),
) -> str:
    """Composite dependency: validates the key + applies rate-limit.

    Security headers are added by ``ExternalSecurityHeadersMiddleware`` so
    they survive ``HTTPException`` paths too.
    """
    allowed, retry_after = _RATE_LIMITER.check(principal)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please retry after a moment.",
            headers={"Retry-After": str(int(retry_after) + 1)},
        )
    response.headers["X-RateLimit-Limit"] = str(CONFIG.rate_limit_per_minute)
    return principal
