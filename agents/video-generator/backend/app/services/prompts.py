"""Prompt assets + fallback prompts for the video agent."""

from __future__ import annotations

from pathlib import Path

from agent_common.prompt_loader import load_prompt_file

PROMPTS_DIR = Path(__file__).resolve().parent.parent / 'prompts'
KLING_PROMPT_PATH = PROMPTS_DIR / 'kling.txt'
VIDEO_IMAGE_PROMPT_SYSTEM_PATH = PROMPTS_DIR / 'video_image_prompt_system.txt'
VIDEO_PROMPT_REPAIR_PATH = PROMPTS_DIR / 'video_prompt_repair.txt'

VIDEO_IMAGE_PROMPT_SYSTEM_FALLBACK = (
    "You are a cinematic image prompt engineer.\n"
    "Create one high-quality, model-ready image prompt in English.\n"
    "Respect the provided brand and user request.\n"
    "Output only the final prompt text without markdown, explanations, or JSON.\n"
    "The prompt should be suitable for a keyframe image used as the first frame of a branded video.\n"
)

PROMPT_REPAIR_SYSTEM_FALLBACK = (
    "You rewrite noisy instruction dumps into one final production-ready prompt.\n"
    "Return only one plain English prompt line.\n"
    "Never include headings, bullets, role text, or policy/rule text.\n"
    'Never include phrases like "You are", "MISSION", "OUTPUT FORMAT", "Execution Instructions", or "User Image Request".\n'
)

KLING_SYSTEM_PROMPT_FALLBACK = (
    'You are a Vision-to-Kling prompt compiler. Analyze the image and return one concise, '
    'production-ready English prompt for image-to-video generation while preserving identity and scene coherence.'
)


def video_image_prompt_system() -> str:
    return load_prompt_file(VIDEO_IMAGE_PROMPT_SYSTEM_PATH, fallback=VIDEO_IMAGE_PROMPT_SYSTEM_FALLBACK)


def prompt_repair_system() -> str:
    return load_prompt_file(VIDEO_PROMPT_REPAIR_PATH, fallback=PROMPT_REPAIR_SYSTEM_FALLBACK)


def kling_system_prompt() -> str:
    return load_prompt_file(KLING_PROMPT_PATH, fallback=KLING_SYSTEM_PROMPT_FALLBACK)


def fallback_image_prompt(brand: str, user_request: str) -> str:
    return (
        f'Premium cinematic hero image for {brand}, centered on {user_request}, '
        'high-end materials, controlled lighting, commercial realism, sharp detail, editorial composition.'
    )


def fallback_video_prompt(brand: str, user_request: str) -> str:
    return (
        f'Cinematic image-to-video shot for {brand}: preserve subject identity and scene from the source image, '
        f'animate {user_request} with smooth natural motion, stable geometry, subtle camera movement, premium lighting, realistic texture fidelity.'
    )
