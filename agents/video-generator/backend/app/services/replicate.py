"""Video-generator Replicate wrapper (Kling).

Pre-binds the Kling model + image-to-video input payload so the routes
can keep calling ``run_video_prediction(...)`` unchanged.
"""

from __future__ import annotations

import os

from agent_common.replicate import run_prediction

DEFAULT_REPLICATE_VIDEO_MODEL = 'kwaivgi/kling-v2.5-turbo-pro'


def get_replicate_video_model() -> str:
    model = (
        os.getenv('REPLICATE_VIDEO_MODEL') or DEFAULT_REPLICATE_VIDEO_MODEL
    ).strip() or DEFAULT_REPLICATE_VIDEO_MODEL
    if model == 'kwaivgi/kling-v2.1-master':
        return DEFAULT_REPLICATE_VIDEO_MODEL
    return model


def run_video_prediction(*, prompt: str, image_url: str, duration: int) -> tuple[str, str]:
    """Return ``(prediction_id, video_url)`` or raise ``RuntimeError``."""
    return run_prediction(
        model=get_replicate_video_model(),
        inputs={
            'prompt': prompt,
            'start_image': image_url,
            'duration': duration,
            'aspect_ratio': '16:9',
            'negative_prompt': (
                'flicker, jitter, wobble, distortion, deformed face, deformed logo, '
                'warped geometry, unstable frame, noisy artifacts'
            ),
        },
        max_polls=120,
        failure_message='Video generation failed.',
    )
