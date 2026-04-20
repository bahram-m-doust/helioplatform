#!/bin/sh
# Production entrypoint for the heliogram Django backend.
# Responsibilities:
#   1. Apply schema migrations (idempotent).
#   2. Collect static files (idempotent; served by edge nginx via /static).
#   3. Create an initial superuser if DJANGO_SUPERUSER_* env vars are set and
#      no such user exists (never overwrites or errors on second boot).
#   4. Start gunicorn bound to :8010 on all interfaces *inside* the container.
#      The docker network + edge nginx isolate it from the public internet.
set -e

echo "[entrypoint.prod] Applying migrations..."
python manage.py migrate --noinput

echo "[entrypoint.prod] Collecting static files..."
python manage.py collectstatic --noinput

# Idempotent superuser bootstrap. All three env vars must be set; otherwise
# we skip silently so the container still boots in reduced-config scenarios.
if [ -n "${DJANGO_SUPERUSER_USERNAME:-}" ] && \
   [ -n "${DJANGO_SUPERUSER_PASSWORD:-}" ] && \
   [ -n "${DJANGO_SUPERUSER_EMAIL:-}" ]; then
  echo "[entrypoint.prod] Ensuring superuser '${DJANGO_SUPERUSER_USERNAME}' exists..."
  python manage.py shell <<'PYCODE'
import os
from django.contrib.auth import get_user_model

User = get_user_model()
username = os.environ["DJANGO_SUPERUSER_USERNAME"]
email = os.environ["DJANGO_SUPERUSER_EMAIL"]
password = os.environ["DJANGO_SUPERUSER_PASSWORD"]

user, created = User.objects.get_or_create(
    username=username,
    defaults={"email": email, "is_staff": True, "is_superuser": True},
)
if created:
    user.set_password(password)
    user.save()
    print(f"[entrypoint.prod] Created superuser '{username}'.")
else:
    # Never clobber an existing operator password on every restart.
    print(f"[entrypoint.prod] Superuser '{username}' already exists; leaving untouched.")
PYCODE
else
  echo "[entrypoint.prod] DJANGO_SUPERUSER_* not fully set; skipping superuser bootstrap."
fi

echo "[entrypoint.prod] Starting gunicorn on 0.0.0.0:8010..."
# Single worker keeps the in-memory SSE bus consistent. Change only after
# introducing an external pub/sub (Redis/NATS).
exec gunicorn heliogram_core.wsgi:application \
  --bind 0.0.0.0:8010 \
  --workers 1 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
