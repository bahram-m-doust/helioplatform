"""Campaign-maker external API security primitives.

Re-exports the per-agent security bundle built from the shared
:mod:`agent_common.security`.
"""

from __future__ import annotations

from agent_common.security import build_security

from app.external.config import CONFIG

_BUNDLE = build_security(CONFIG)

api_key_principal = _BUNDLE.api_key_principal
require_caller = _BUNDLE.require_caller
ExternalSecurityHeadersMiddleware = _BUNDLE.middleware
