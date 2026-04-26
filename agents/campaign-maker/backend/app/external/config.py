"""Campaign-maker external API config.

Pre-binds the per-agent API-key env-var (``HELIO_EXTERNAL_API_KEYS_CAMPAIGN``);
shared knobs come from :mod:`agent_common.external_config`.
"""

from __future__ import annotations

from agent_common.external_config import ExternalConfig, load_config

CONFIG: ExternalConfig = load_config(
    api_keys_env='HELIO_EXTERNAL_API_KEYS_CAMPAIGN',
    rate_per_minute_default=30,
    rate_burst_default=10,
)

# Campaign-maker-specific payload caps and chat defaults.
MAX_MESSAGE_CHARS = 4000
MAX_MESSAGES = 20
DEFAULT_MAX_TOKENS = 900
DEFAULT_TEMPERATURE = 0.7
