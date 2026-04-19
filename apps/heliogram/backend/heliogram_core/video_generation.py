"""Compatibility bridge for video generation APIs.

Phase-2 migration note:
- Runtime implementation lives in `apps.agents.video_generator.api`.
- This module stays as a backward-compatible import path.
"""

from apps.agents.video_generator.api import (
    VideoGenerationProxyView,
    VideoImagePromptView,
    VideoPromptFromImageView,
)

__all__ = ['VideoImagePromptView', 'VideoPromptFromImageView', 'VideoGenerationProxyView']

