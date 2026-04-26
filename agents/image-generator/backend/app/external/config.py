"""Runtime configuration for the external (public) image-generator API.

Every value is read from the environment so the same image runs in dev,
staging and prod without code changes. Defaults are deliberately strict:
no API keys = the public surface is closed; no allowed origins = no
browser will be granted CORS access (server-to-server still works).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _split_csv(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def _parse_keys(raw: str | None) -> dict[str, str]:
    """Parse ``HELIO_EXTERNAL_API_KEYS_IMAGE`` as ``label:secret`` pairs.

    Accepts a bare secret too (label defaults to ``key-N``) so a single
    quick key can be issued without ceremony. Labels are only used in
    logs; the secret is what authenticates the request.
    """
    pairs: dict[str, str] = {}
    for index, item in enumerate(_split_csv(raw)):
        if ":" in item:
            label, secret = item.split(":", 1)
            label = label.strip() or f"key-{index + 1}"
            secret = secret.strip()
        else:
            label, secret = f"key-{index + 1}", item
        if secret:
            pairs[label] = secret
    return pairs


@dataclass(frozen=True)
class ExternalConfig:
    api_keys: dict[str, str] = field(default_factory=dict)
    allowed_origins: list[str] = field(default_factory=list)
    rate_limit_per_minute: int = 30
    rate_limit_burst: int = 10
    max_user_request_chars: int = 2000
    max_prompt_chars: int = 4000
    max_reference_images: int = 4

    @property
    def enabled(self) -> bool:
        return bool(self.api_keys)


def load_config() -> ExternalConfig:
    return ExternalConfig(
        api_keys=_parse_keys(os.getenv("HELIO_EXTERNAL_API_KEYS_IMAGE")),
        allowed_origins=_split_csv(os.getenv("HELIO_EXTERNAL_ALLOWED_ORIGINS")),
        rate_limit_per_minute=int(os.getenv("HELIO_EXTERNAL_RATE_PER_MINUTE", "30")),
        rate_limit_burst=int(os.getenv("HELIO_EXTERNAL_RATE_BURST", "10")),
        max_user_request_chars=int(os.getenv("HELIO_EXTERNAL_MAX_REQUEST_CHARS", "2000")),
        max_prompt_chars=int(os.getenv("HELIO_EXTERNAL_MAX_PROMPT_CHARS", "4000")),
        max_reference_images=int(os.getenv("HELIO_EXTERNAL_MAX_REFERENCE_IMAGES", "4")),
    )


CONFIG = load_config()
