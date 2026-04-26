"""Runtime configuration for the external (public) video-generator API."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _split_csv(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def _parse_keys(raw: str | None) -> dict[str, str]:
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
    rate_limit_per_minute: int = 10
    rate_limit_burst: int = 4
    max_user_request_chars: int = 2000
    min_duration: int = 1
    max_duration: int = 10

    @property
    def enabled(self) -> bool:
        return bool(self.api_keys)


def load_config() -> ExternalConfig:
    return ExternalConfig(
        api_keys=_parse_keys(os.getenv("HELIO_EXTERNAL_API_KEYS_VIDEO")),
        allowed_origins=_split_csv(os.getenv("HELIO_EXTERNAL_ALLOWED_ORIGINS")),
        rate_limit_per_minute=int(os.getenv("HELIO_EXTERNAL_RATE_PER_MINUTE", "10")),
        rate_limit_burst=int(os.getenv("HELIO_EXTERNAL_RATE_BURST", "4")),
        max_user_request_chars=int(os.getenv("HELIO_EXTERNAL_MAX_REQUEST_CHARS", "2000")),
        min_duration=int(os.getenv("HELIO_EXTERNAL_MIN_DURATION", "1")),
        max_duration=int(os.getenv("HELIO_EXTERNAL_MAX_DURATION", "10")),
    )


CONFIG = load_config()
