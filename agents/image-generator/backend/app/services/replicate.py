"""Image-generator Replicate wrapper (Seedream).

Pre-binds the Seedream 4.5 model + image-shaped input payload so the
routes can keep calling ``run_image_prediction(...)`` unchanged.
"""

from __future__ import annotations

import os

from agent_common.replicate import run_prediction

REPLICATE_DEFAULT_MODEL = 'bytedance/seedream-4.5'


def get_replicate_model() -> str:
    return (
        os.getenv('REPLICATE_IMAGE_MODEL') or REPLICATE_DEFAULT_MODEL
    ).strip() or REPLICATE_DEFAULT_MODEL


def run_image_prediction(*, prompt: str, image_input: list[str]) -> tuple[str, str]:
    """Return ``(prediction_id, image_url)`` or raise ``RuntimeError``."""
    return run_prediction(
        model=get_replicate_model(),
        inputs={
            'prompt': prompt,
            'image_input': image_input,
            'aspect_ratio': '16:9',
            'max_images': 1,
            'sequential_image_generation': 'disabled',
        },
        max_polls=80,
        failure_message='Image generation failed.',
    )
