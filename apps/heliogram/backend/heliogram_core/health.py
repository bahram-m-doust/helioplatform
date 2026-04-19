from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from django.utils import timezone
from django.views import View


class HealthView(View):
    """Lightweight liveness/readiness endpoint for local and VPS orchestration."""

    def get(self, request):
        database_status = 'ok'
        database_error = None

        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
                cursor.fetchone()
        except Exception as exc:  # pragma: no cover - guarded runtime check
            database_status = 'error'
            database_error = str(exc)

        app_status = 'ok' if database_status == 'ok' else 'degraded'
        payload = {
            'status': app_status,
            'database': database_status,
            'app': getattr(settings, 'APP_NAME', 'HelioGram'),
            'timestamp': timezone.now().isoformat(),
        }

        if database_error and settings.DEBUG:
            payload['database_error'] = database_error

        return JsonResponse(payload, status=200 if app_status == 'ok' else 503)
