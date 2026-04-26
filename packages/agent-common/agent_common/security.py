"""Security primitives for the public ``/v1/*`` API surface.

Three concerns kept in one module because they are all request-scoped and
small:

* ``api_key_principal`` — FastAPI dependency that validates ``X-API-Key``
  against the configured key set in constant time.
* ``RateLimiter``       — in-memory token bucket per principal, single-process.
  Promote to Redis the moment the agent runs more than one replica.
* ``require_caller``    — composite dependency: auth + rate-limit.
* ``ExternalSecurityHeadersMiddleware`` — adds defensive response headers to
  every ``/v1/*`` response (success AND error paths).

Each agent calls ``build_security(config)`` to receive a per-agent bundle
of (principal_dep, require_caller_dep, middleware_class) so the limiter
state stays scoped to one agent process.
"""

from __future__ import annotations

import secrets
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

from agent_common.external_config import ExternalConfig

_SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'interest-cohort=()',
    'Cache-Control': 'no-store',
}


def _resolve_principal(presented: str, config: ExternalConfig) -> str | None:
    """Return the matching key's label, or ``None`` if no key matches.

    Compares against every configured secret in constant time so the
    runtime is independent of which (or how many) keys exist — this
    prevents timing oracles that would otherwise reveal valid keys.
    """
    presented_bytes = presented.encode('utf-8')
    matched_label: str | None = None
    for label, secret in config.api_keys.items():
        if secrets.compare_digest(presented_bytes, secret.encode('utf-8')):
            matched_label = label
    return matched_label


class RateLimiter:
    """Token-bucket rate limiter. Single-process, thread-safe, O(1) per check."""

    def __init__(self, *, per_minute: int, burst: int) -> None:
        self._refill_per_second = max(per_minute, 1) / 60.0
        self._capacity = float(max(burst, 1))
        self._buckets: dict[str, tuple[float, float]] = {}
        self._lock = threading.Lock()

    def check(self, principal: str) -> tuple[bool, float]:
        """Consume one token. Returns ``(allowed, retry_after_seconds)``."""
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


class ExternalSecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Apply security headers to every /v1/* response, including error ones.

    Dependency-scoped header writes don't survive ``HTTPException`` — FastAPI
    builds a fresh response from the exception, so headers set on the
    injected ``Response`` object are dropped on the error path. A middleware
    runs after the response is built, so it covers both success and error.
    """

    async def dispatch(self, request: StarletteRequest, call_next):  # type: ignore[override]
        response = await call_next(request)
        if request.url.path.startswith('/v1'):
            for name, value in _SECURITY_HEADERS.items():
                response.headers.setdefault(name, value)
        return response


@dataclass(frozen=True)
class SecurityBundle:
    """Per-agent security primitives. Build with :func:`build_security`."""

    api_key_principal: Callable[..., str]
    require_caller: Callable[..., str]
    middleware: type[ExternalSecurityHeadersMiddleware]


def build_security(config: ExternalConfig) -> SecurityBundle:
    """Build a per-agent security bundle.

    Each agent gets its own ``RateLimiter`` instance so buckets do not
    cross-contaminate when more than one agent runs in the same Python
    process (e.g. a test harness importing all four).
    """
    limiter = RateLimiter(
        per_minute=config.rate_limit_per_minute,
        burst=config.rate_limit_burst,
    )

    def api_key_principal(
        x_api_key: str | None = Header(default=None, alias='X-API-Key'),
    ) -> str:
        if not config.enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail='External API is not configured on this deployment.',
            )
        presented = (x_api_key or '').strip()
        if not presented:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='Missing X-API-Key header.',
                headers={'WWW-Authenticate': 'ApiKey realm="helio-external"'},
            )
        label = _resolve_principal(presented, config)
        if label is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='Invalid API key.',
                headers={'WWW-Authenticate': 'ApiKey realm="helio-external"'},
            )
        return label

    def require_caller(
        response: Response,
        principal: str = Depends(api_key_principal),
    ) -> str:
        allowed, retry_after = limiter.check(principal)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail='Rate limit exceeded. Please retry after a moment.',
                headers={'Retry-After': str(int(retry_after) + 1)},
            )
        response.headers['X-RateLimit-Limit'] = str(config.rate_limit_per_minute)
        return principal

    return SecurityBundle(
        api_key_principal=api_key_principal,
        require_caller=require_caller,
        middleware=ExternalSecurityHeadersMiddleware,
    )
