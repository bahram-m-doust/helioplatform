"""Image-generator external API config.

Pre-binds the per-agent API-key env-var (``HELIO_EXTERNAL_API_KEYS_IMAGE``);
everything else (allowed origins, rate limits) is shared via
:mod:`agent_common.external_config`.
"""

from __future__ import annotations

from agent_common.external_config import ExternalConfig, load_config

CONFIG: ExternalConfig = load_config(
    api_keys_env='HELIO_EXTERNAL_API_KEYS_IMAGE',
    rate_per_minute_default=30,
    rate_burst_default=10,
)

# Image-generator-specific payload caps; consumed by app/external/schemas.py.
MAX_USER_REQUEST_CHARS = 2000
MAX_PROMPT_CHARS = 4000
MAX_REFERENCE_IMAGES = 4
