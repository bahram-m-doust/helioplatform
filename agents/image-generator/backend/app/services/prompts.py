"""Prompt assets + brand context + fallback prompts for the image agent."""

from __future__ import annotations

from pathlib import Path

from app.services.prompt_loader import load_prompt_file

PROMPTS_DIR = Path(__file__).resolve().parent.parent / 'prompts'
IMAGE_PROMPT_SYSTEM_PATH = PROMPTS_DIR / 'image_prompt_system.txt'
PROMPT_REPAIR_SYSTEM_PATH = PROMPTS_DIR / 'prompt_repair.txt'

IMAGE_PROMPT_SYSTEM_FALLBACK = (
    "You are a subject-first visual prompt architect for Seedream 4.5.\n"
    "You must transform each user request into exactly one final, production-ready English image prompt.\n\n"
    "Hard rules:\n"
    "1) Subject-first: the user's requested subject is always the hero.\n"
    "2) Brand is support layer: brand identity must style the scene without replacing the subject.\n"
    "3) Short-request expansion: if request is short or generic, expand into a complete commercially credible scene.\n"
    "4) Scene routing: infer category and apply matching visual logic.\n"
    "5) Clean output: return only one final prompt line, plain text, no markdown, no bullets, no explanations.\n"
    "6) Positive language only: never include negative-prompt or policy-like text.\n"
    "7) Keep prompt compact but rich: target roughly 45-110 words.\n"
    "8) Prefer realistic, premium, high-clarity composition.\n"
)

PROMPT_REPAIR_SYSTEM_FALLBACK = (
    "You receive leaked policy/instruction text and must rewrite it into one final production-ready image prompt.\n"
    "Return one plain English prompt line only.\n"
    "Do not include role text, headings, bullets, or policy language.\n"
    'Do not include phrases like "You are", "MISSION", "OUTPUT FORMAT", "Execution Instructions", "User Image Request".\n'
)


BRAND_CONTEXT = {
    'mansory': (
        'Bespoke engineered luxury, visible carbon fiber, sharp aerodynamic form language, dark premium palette '
        'with controlled gold accents, precision detailing, elite showroom/editorial atmosphere.'
    ),
    'technogym': (
        'Premium wellness technology, precision training aesthetics, monolithic clean geometry, black/white/grey base '
        'with restrained yellow accents, human-centered performance realism.'
    ),
    'binghatti': (
        'Dubai luxury architectural identity, bold geometric forms, premium urban materiality, warm neutrals with dark '
        'metallic contrast, investment-grade premium lifestyle mood, logo/pattern as subtle supporting layer.'
    ),
}

DEFAULT_BRAND_CONTEXT = (
    'Premium contemporary brand language with controlled accents, realistic materiality, and commercial clarity.'
)


def image_prompt_system() -> str:
    return load_prompt_file(IMAGE_PROMPT_SYSTEM_PATH, fallback=IMAGE_PROMPT_SYSTEM_FALLBACK)


def prompt_repair_system() -> str:
    return load_prompt_file(PROMPT_REPAIR_SYSTEM_PATH, fallback=PROMPT_REPAIR_SYSTEM_FALLBACK)


def fallback_subject_first_prompt(brand: str, user_request: str) -> str:
    return (
        f'Premium cinematic commercial image for {brand}, subject-first composition centered on {user_request}, '
        'high-detail materials, clear functional realism, elegant lighting hierarchy, strong focal clarity, '
        'brand identity as subtle supporting layer, editorial-quality finish.'
    )
