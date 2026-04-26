"""Video-generator external API config.

Pre-binds the per-agent API-key env-var (``HELIO_EXTERNAL_API_KEYS_VIDEO``);
shared knobs (allowed origins, rate limits) come from
:mod:`agent_common.external_config`.

Video renders are expensive, so the rate-limit defaults here are stricter
than the platform default (10 r/m + burst 4 vs 30 r/m + burst 10).
"""

from __future__ import annotations

from agent_common.external_config import ExternalConfig, load_config

CONFIG: ExternalConfig = load_config(
    api_keys_env='HELIO_EXTERNAL_API_KEYS_VIDEO',
    rate_per_minute_default=10,
    rate_burst_default=4,
)

# Video-generator-specific payload caps; consumed by app/external/schemas.py.
MAX_USER_REQUEST_CHARS = 2000
MIN_DURATION = 1
MAX_DURATION = 10
