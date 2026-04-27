"""Image-generator external API security primitives.

In Phase 3 the per-agent ``require_tenant`` dependency replaces
``require_caller``. ``build_tenant_resolver`` falls back to the
legacy env-var X-API-Key flow when ``SUPABASE_URL`` is unset, so this
agent keeps working unchanged in deployments that haven't migrated
to the multi-tenant control plane yet.

The security-headers middleware stays exactly as it was — it's
orthogonal to the auth flow.
"""

from __future__ import annotations

from agent_common.security import build_security
from agent_common.tenant import build_tenant_resolver

from app.external.config import CONFIG

# Build both: the headers middleware (still needed) and the legacy
# bundle's middleware reference (kept as a backwards-compat alias for
# any code that imported it before Phase 3).
_BUNDLE = build_security(CONFIG)
ExternalSecurityHeadersMiddleware = _BUNDLE.middleware

# The new dependency every /v1 route uses.
require_tenant = build_tenant_resolver(config=CONFIG)
