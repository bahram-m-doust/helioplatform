"""Compatibility bridge for image generation APIs.

Phase-2 migration note:
- Runtime implementation lives in `apps.agents.image_generator.api`.
- This module stays as a backward-compatible import path.
"""

from apps.agents.image_generator.api import ImageGenerationProxyView, ImagePromptView

__all__ = ['ImagePromptView', 'ImageGenerationProxyView']

