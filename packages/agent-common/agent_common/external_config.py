"""Runtime configuration for the public ``/v1/*`` API surface.

The agent-specific bit is which env var holds the API-key list (each agent
gets its own keyspace so they can be rotated independently). Everything
else — allowed origins, rate limits, payload caps — is shared.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _split_csv(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(',') if item.strip()]


def _parse_keys(raw: str | None) -> dict[str, str]:
    """Parse ``label:secret,label:secret`` (or bare ``secret``) into a dict.

    Bare secrets get an auto-generated label ``key-N``. Labels are only used
    in logs; the secret is what authenticates the request.
    """
    pairs: dict[str, str] = {}
    for index, item in enumerate(_split_csv(raw)):
        if ':' in item:
            label, secret = item.split(':', 1)
            label = label.strip() or f'key-{index + 1}'
            secret = secret.strip()
        else:
            label, secret = f'key-{index + 1}', item
        if secret:
            pairs[label] = secret
    return pairs


@dataclass(frozen=True)
class ExternalConfig:
    api_keys: dict[str, str] = field(default_factory=dict)
    allowed_origins: list[str] = field(default_factory=list)
    rate_limit_per_minute: int = 30
    rate_limit_burst: int = 10

    @property
    def enabled(self) -> bool:
        return bool(self.api_keys)


def load_config(
    *,
    api_keys_env: str,
    rate_per_minute_default: int = 30,
    rate_burst_default: int = 10,
) -> ExternalConfig:
    return ExternalConfig(
        api_keys=_parse_keys(os.getenv(api_keys_env)),
        allowed_origins=_split_csv(os.getenv('HELIO_EXTERNAL_ALLOWED_ORIGINS')),
        rate_limit_per_minute=int(
            os.getenv('HELIO_EXTERNAL_RATE_PER_MINUTE', str(rate_per_minute_default))
        ),
        rate_limit_burst=int(
            os.getenv('HELIO_EXTERNAL_RATE_BURST', str(rate_burst_default))
        ),
    )
