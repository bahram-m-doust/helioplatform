"""Prompt assets for the Soul Print agent.

A single profile (``Soul Print``) — the system prompt drives every turn
of a multi-turn conversation that maps a user's brand DNA. Lives in
``app/prompts/soul_print.txt`` so the agent author can iterate without
a code change.
"""

from __future__ import annotations

from pathlib import Path

from agent_common.prompt_loader import load_prompt_file

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
SOUL_PRINT_PATH = PROMPTS_DIR / "soul_print.txt"

SOUL_PRINT_FALLBACK = (
    "You are a Brand Strategy Agent who builds brands as cities. "
    "Discover the existential logic of a brand, extract it from the "
    "Soulprints of its founders, translate it into a strategic city "
    "model, and finally turn that model into a human, coherent, and "
    "emotionally resonant Story of City. Work in structured phases; "
    "ask one focused question at a time."
)


def soul_print_system_prompt() -> str:
    return load_prompt_file(SOUL_PRINT_PATH, fallback=SOUL_PRINT_FALLBACK)


WELCOME_MESSAGE = (
    "Welcome to Soul Print. I'm here to map your personal brand's logic "
    "and define the personal identity that's already within you.\n"
    "To begin — what is your name?"
)
