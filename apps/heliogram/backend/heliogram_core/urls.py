from django.contrib import admin
from django.urls import path, include
from .health import HealthView
from apps.agents.image_generator.api import ImageGenerationProxyView, ImagePromptView
from apps.agents.video_generator.api import (
    VideoGenerationProxyView,
    VideoImagePromptView,
    VideoPromptFromImageView,
)

urlpatterns = [
    # Django admin for operational/debug management.
    path('admin/', admin.site.urls),
    path('api/health/', HealthView.as_view(), name='api_health'),
    path('api/ai/image/prompt/', ImagePromptView.as_view(), name='api_image_prompt'),
    path('api/ai/image/generate/', ImageGenerationProxyView.as_view(), name='api_image_generate'),
    path('api/ai/video/image-prompt/', VideoImagePromptView.as_view(), name='api_video_image_prompt'),
    path('api/ai/video/prompt-from-image/', VideoPromptFromImageView.as_view(), name='api_video_prompt_from_image'),
    path('api/ai/video/generate/', VideoGenerationProxyView.as_view(), name='api_video_generate'),

    # API surface grouped by domain app.
    path('api/auth/', include('apps.authentication.urls')),
    path('api/workspaces/', include('apps.workspaces.urls')),
    path('api/channels/', include('apps.messaging.urls')),
    path('api/dm/', include('apps.dm.urls')),
    path('api/files/', include('apps.files.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/search/', include('apps.search.urls')),
    path('api/calls/', include('apps.calls.urls')),
    path('api/realtime/', include('realtime.urls')),
]
