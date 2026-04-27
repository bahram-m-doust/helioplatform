"""Soul-print external API config.

Pre-binds the per-agent API-key env-var
(``HELIO_EXTERNAL_API_KEYS_SOUL_PRINT``); shared knobs come from
:mod:`agent_common.external_config`.
"""

from __future__ import annotations

from agent_common.external_config import ExternalConfig, load_config

CONFIG: ExternalConfig = load_config(
    api_keys_env="HELIO_EXTERNAL_API_KEYS_SOUL_PRINT",
    rate_per_minute_default=15,
    rate_burst_default=5,
)

# Soul-print payload caps. Conversations can be long, so message length
# allowance is generous; total messages capped to keep the upstream
# context affordable.
MAX_MESSAGE_CHARS = 6000
MAX_MESSAGES = 60
DEFAULT_MAX_TOKENS = 1200
DEFAULT_TEMPERATURE = 0.65
