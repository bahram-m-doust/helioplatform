"""Multi-tenant primitives shared across every Helio agent backend.

The agents resolve a ``TenantContext`` from one of two auth flows:

* **Browser callers** carry a Supabase-issued ``Authorization: Bearer <jwt>``.
  ``app_metadata.brand_id`` is the authoritative tenant claim;
  ``Origin`` is cross-checked against ``brand_subdomains`` for
  defense-in-depth.
* **Server-to-server callers** carry an ``X-API-Key``. The key hash
  resolves to one and only one ``brand_id`` via ``brand_api_keys``;
  no user identity is attached.

Once resolved, route handlers receive a ``TenantContext`` and pass
``tenant.brand_id`` to every Supabase query. Agents NEVER hold the
service-role key — read paths inherit RLS via the user's JWT, and the
X-API-Key path uses an explicit ``where brand_id = $1`` filter.
"""

from agent_common.tenant.audit import consume_quota, get_brand_agent_config, record_run
from agent_common.tenant.context import TenantContext
from agent_common.tenant.resolver import build_tenant_resolver

__all__ = [
    "TenantContext",
    "build_tenant_resolver",
    "consume_quota",
    "get_brand_agent_config",
    "record_run",
]
