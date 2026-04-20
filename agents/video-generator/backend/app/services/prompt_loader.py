"""Shared loader for file-based LLM system prompts."""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


_MOJIBAKE_REPLACEMENTS = {
    '\u00e2\u20ac\u2122': "'",
    '\u00e2\u20ac\u0153': '"',
    '\u00e2\u20ac\u009d': '"',
    '\u00e2\u20ac\u201d': '-',
    '\u00e2\u20ac\u201c': '-',
    '\u00e2\u20ac\u00a6': '...',
}


def load_prompt_file(path: Path, *, fallback: str) -> str:
    try:
        if not path.exists():
            logger.warning('Prompt file missing, using fallback: %s', path)
            return fallback.strip()

        raw = path.read_text(encoding='utf-8', errors='ignore').replace('\ufeff', '')
        for broken, fixed in _MOJIBAKE_REPLACEMENTS.items():
            raw = raw.replace(broken, fixed)
        cleaned = raw.strip()
        if not cleaned:
            logger.warning('Prompt file is empty, using fallback: %s', path)
            return fallback.strip()
        return cleaned
    except OSError as read_error:
        logger.warning('Prompt file unreadable (%s), using fallback: %s', read_error, path)
        return fallback.strip()
