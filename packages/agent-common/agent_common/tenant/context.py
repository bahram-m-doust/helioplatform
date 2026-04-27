"""The ``TenantContext`` dataclass — the only thing route handlers need.

Created by ``build_tenant_resolver(...)`` in ``resolver.py``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class TenantContext:
    """The verified caller, scoped to exactly one brand.

    Attributes:
        brand_id: UUID of the resolved brand. Always present.
        brand_slug: Convenience copy of ``brands.slug`` (set when the
            resolver populated it; may be empty on the X-API-Key fast
            path that doesn't fetch the full brand row).
        user_id: UUID of the Supabase user. ``None`` for X-API-Key
            (server-to-server) callers.
        api_key_id: UUID of the brand_api_keys row used to authenticate.
            ``None`` for JWT callers.
        auth_method: How the caller authenticated. Used in audit logs.
        bearer_token: The original ``Authorization: Bearer <jwt>`` token,
            forwarded verbatim to Supabase so PostgREST applies RLS as
            the user. ``None`` for X-API-Key callers (those use an
            explicit ``where brand_id = $1`` filter on the anon key).
        role: ``app_metadata.role`` claim from the JWT, or ``"member"``
            on the X-API-Key path. Used to gate admin-only endpoints.
    """

    brand_id: str
    brand_slug: str
    user_id: str | None
    api_key_id: str | None
    auth_method: Literal["jwt", "api_key"]
    bearer_token: str | None
    role: str
