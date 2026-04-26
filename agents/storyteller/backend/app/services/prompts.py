"""Prompt assets + profile registry for the Storyteller agent.

Each profile maps a short human label (shown in the UI) to the system
prompt text loaded from ``app/prompts``. Profiles are the single source
of truth for what options the frontend is allowed to request.
"""

from __future__ import annotations

from pathlib import Path

from agent_common.prompt_loader import load_prompt_file

PROMPTS_DIR = Path(__file__).resolve().parent.parent / 'prompts'
BRAND_LANGUAGE_PATH = PROMPTS_DIR / 'brand-language.txt'
LANGUAGE_STYLE_PATH = PROMPTS_DIR / 'language-style.txt'

BRAND_LANGUAGE_FALLBACK = (
    "You are the Helio Storyteller Agent. Craft narrative brand stories that "
    "speak in the brand's own BRAND LANGUAGE. Use the user's provided brand "
    "voice, lexicon, and tonal rules. Return a single, polished narrative in "
    "plain prose without markdown headings or bullet lists."
)

LANGUAGE_STYLE_FALLBACK = (
    "You are a Language Style Consultant. Analyze, define, preserve, translate, "
    "and reconstruct writing style with high precision. Respond with a single, "
    "polished narrative in the requested style, in plain prose without markdown "
    "headings or bullet lists."
)


def brand_language_prompt() -> str:
    return load_prompt_file(BRAND_LANGUAGE_PATH, fallback=BRAND_LANGUAGE_FALLBACK)


def language_style_prompt() -> str:
    return load_prompt_file(LANGUAGE_STYLE_PATH, fallback=LANGUAGE_STYLE_FALLBACK)


PROFILE_PROMPTS: dict[str, callable] = {
    'Brand Language': brand_language_prompt,
    'Language Style': language_style_prompt,
}


def resolve_profile_prompt(profile: str) -> str | None:
    loader = PROFILE_PROMPTS.get(profile)
    if loader is None:
        return None
    return loader()


def available_profiles() -> list[str]:
    return list(PROFILE_PROMPTS.keys())
