from django.contrib import admin
from django.urls import path, include
from .health import HealthView

urlpatterns = [
    # Django admin for operational/debug management.
    path('admin/', admin.site.urls),
    path('api/health/', HealthView.as_view(), name='api_health'),

    # API surface grouped by domain app.
    # AI agents (image/video generation, etc.) now live in separate FastAPI
    # microservices under `/agents/*/backend/`. The frontend points at those
    # services directly via `VITE_IMAGE_AGENT_API_BASE_URL` /
    # `VITE_VIDEO_AGENT_API_BASE_URL`.
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
