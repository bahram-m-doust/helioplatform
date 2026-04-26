"""Public/external HTTP surface for the agent.

Mounted at ``/v1`` by ``app.main``. Used by third-party sites (Framer,
custom landing pages, etc.) to call the agent from outside the platform.
Internal frontend calls keep using the ``/api`` routes in ``app.api``.
"""

from app.external.routes import router as external_router
from app.external.security import ExternalSecurityHeadersMiddleware

__all__ = ["external_router", "ExternalSecurityHeadersMiddleware"]
