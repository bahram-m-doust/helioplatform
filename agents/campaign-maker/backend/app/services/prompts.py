"""Prompt assets + brand registry for the Campaign Maker agent."""

from __future__ import annotations

from pathlib import Path

from agent_common.prompt_loader import load_prompt_file

PROMPTS_DIR = Path(__file__).resolve().parent.parent / 'prompts'
MANSORY_PATH = PROMPTS_DIR / 'mansory.txt'
TECHNOGYM_PATH = PROMPTS_DIR / 'technogym.txt'
BINGHATTI_PATH = PROMPTS_DIR / 'binghatti.txt'

GENERIC_FALLBACK = (
    "You are the Helio Campaign Maker agent. Help the user plan and structure "
    "marketing campaigns that match their chosen brand profile. Ask clarifying "
    "questions, then return a structured campaign plan in clear sections."
)


def mansory_prompt() -> str:
    return load_prompt_file(MANSORY_PATH, fallback=GENERIC_FALLBACK)


def technogym_prompt() -> str:
    return load_prompt_file(TECHNOGYM_PATH, fallback=GENERIC_FALLBACK)


def binghatti_prompt() -> str:
    return load_prompt_file(BINGHATTI_PATH, fallback=GENERIC_FALLBACK)


BRAND_PROMPTS: dict[str, callable] = {
    'Mansory': mansory_prompt,
    'Technogym': technogym_prompt,
    'Binghatti': binghatti_prompt,
}


def resolve_brand_prompt(brand: str) -> str | None:
    loader = BRAND_PROMPTS.get(brand)
    if loader is None:
        return None
    return loader()


def available_brands() -> list[str]:
    return list(BRAND_PROMPTS.keys())
