"""60-second in-process cache of ``brand_members`` lookups.

A JWT carries ``app_metadata.brand_id``, but membership can be revoked
in the database without the user's JWT being invalidated (Supabase
JWTs are bearer tokens with an exp, not a session cookie). To respect
revocations promptly we re-check ``brand_members`` on every call —
but we cache the result for 60 seconds so a hot agent doesn't hit
PostgREST 30 times per minute per user.

This is single-process. When agents scale to N replicas, each replica
keeps its own cache; revocations therefore take effect within 60s
across the fleet, which matches the design tolerance in the plan.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass

_TTL_SECONDS = 60.0


@dataclass(frozen=True)
class _Entry:
    valid: bool
    role: str
    cached_at: float


_lock = threading.Lock()
_cache: dict[tuple[str, str], _Entry] = {}


def get_cached_membership(user_id: str, brand_id: str) -> _Entry | None:
    now = time.monotonic()
    with _lock:
        entry = _cache.get((user_id, brand_id))
        if entry is None or now - entry.cached_at > _TTL_SECONDS:
            return None
        return entry


def set_cached_membership(user_id: str, brand_id: str, *, valid: bool, role: str) -> None:
    with _lock:
        _cache[(user_id, brand_id)] = _Entry(valid=valid, role=role, cached_at=time.monotonic())


def invalidate(user_id: str, brand_id: str) -> None:
    with _lock:
        _cache.pop((user_id, brand_id), None)
