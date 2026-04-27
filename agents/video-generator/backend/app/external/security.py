"""Video-generator external API security primitives.

Phase 3: ``require_tenant`` replaces ``require_caller``. Falls back to
the legacy env-var X-API-Key flow when ``SUPABASE_URL`` is unset.
"""

from __future__ import annotations

from agent_common.security import build_security
from agent_common.tenant import build_tenant_resolver

from app.external.config import CONFIG

_BUNDLE = build_security(CONFIG)
ExternalSecurityHeadersMiddleware = _BUNDLE.middleware

require_tenant = build_tenant_resolver(config=CONFIG)
