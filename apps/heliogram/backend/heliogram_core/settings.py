"""Django settings for HelioGram.

The project intentionally keeps the runtime simple for local development:
- API server on localhost:8010
- SPA dev server on localhost:5050
- JWT auth for API calls
- SSE endpoint for realtime updates

Environment values are loaded through python-decouple.
Important: DEBUG must be a boolean-like value (True/False, 1/0), not free text.
"""

import os
import socket
from pathlib import Path
from datetime import timedelta
from urllib.parse import urlparse

from decouple import config, Csv
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

def parse_bool(value, default=False):
    """Safe boolean parsing for env vars with controlled fallback."""
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    normalized = str(value).strip().lower()
    if normalized in {'1', 'true', 'yes', 'on'}:
        return True
    if normalized in {'0', 'false', 'no', 'off'}:
        return False
    return default

# Core runtime flags.
SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me')
DEBUG = parse_bool(config('DEBUG', default='True'), default=True)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())
ALLOWED_HOSTS = [host.strip() for host in ALLOWED_HOSTS if host and host.strip()]
ALLOW_LAN_DEV_ORIGINS = parse_bool(config('ALLOW_LAN_DEV_ORIGINS', default='True'), default=True)

# Production safety: refuse to boot with insecure defaults when DEBUG=False.
# In DEBUG mode we intentionally stay permissive so local development "just works".
if not DEBUG:
    if not SECRET_KEY or SECRET_KEY.startswith('django-insecure-'):
        raise ImproperlyConfigured(
            'SECRET_KEY must be set to a strong, non-default value when DEBUG=False. '
            'Set SECRET_KEY in the environment (e.g. via .env or your deploy config).'
        )
    if not ALLOWED_HOSTS:
        raise ImproperlyConfigured(
            'ALLOWED_HOSTS must be set (non-empty) when DEBUG=False. '
            'Example: ALLOWED_HOSTS=your-domain.com,your-public-ip'
        )

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'corsheaders',
    'django_filters',
    # Local apps
    'apps.authentication',
    'apps.workspaces',
    'apps.messaging',
    'apps.dm',
    'apps.files',
    'apps.notifications',
    'apps.search',
    'apps.calls',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # WhiteNoise serves /static/ files (Django admin CSS/JS, DRF browsable API,
    # collected app statics) directly from the gunicorn process when DEBUG=False.
    # Must sit immediately after SecurityMiddleware per WhiteNoise docs.
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'heliogram_core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'heliogram_core.wsgi.application'

USE_SQLITE = parse_bool(config('USE_SQLITE', default='True'), default=True)
if USE_SQLITE:
    # Native local mode (zero external dependencies).
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    # Deploy mode (Compose/production database).
    DATABASES = {
        'default': {
            'ENGINE': config('DB_ENGINE', default='django.db.backends.postgresql'),
            'NAME': config('DB_NAME', default='heliogram'),
            'USER': config('DB_USER', default='heliogram'),
            'PASSWORD': config('DB_PASSWORD', default='heliogram'),
            'HOST': config('DB_HOST', default='db'),
            'PORT': config('DB_PORT', default='5432'),
            'CONN_MAX_AGE': config('DB_CONN_MAX_AGE', default=60, cast=int),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# WhiteNoise serves /static/ assets from STATIC_ROOT directly out of the
# gunicorn process (see WhiteNoiseMiddleware in MIDDLEWARE above). We keep
# the default storage backend to avoid manifest issues if any third-party
# CSS references an asset that wasn't collected.

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS
# FRONTEND_URL may contain a path (e.g. "http://host/heliogram") because it is
# also used to build absolute links such as password-reset URLs. CORS origins,
# however, must be scheme+host[:port] only (django-cors-headers E014), so we
# normalize before appending.
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:5050')
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5050,http://localhost:4000,http://127.0.0.1:4000',
    cast=Csv(),
)


def _origin_from_url(url: str) -> str:
    if not url:
        return ''
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return ''
    return f'{parsed.scheme}://{parsed.netloc}'


CORS_ALLOWED_ORIGINS = [
    _origin_from_url(origin) for origin in CORS_ALLOWED_ORIGINS if origin
]
CORS_ALLOWED_ORIGINS = [origin for origin in CORS_ALLOWED_ORIGINS if origin]
_frontend_origin = _origin_from_url(FRONTEND_URL)
if _frontend_origin and _frontend_origin not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS.append(_frontend_origin)
CORS_ALLOW_CREDENTIALS = True

# CSRF: Django 4+ requires CSRF_TRUSTED_ORIGINS for POST forms (e.g. the
# Django admin) when the request scheme/host doesn't trivially match the
# server. We derive a safe default from the configured CORS origins and
# every ALLOWED_HOSTS entry over both http and https; an explicit env var
# overrides everything.
def _build_default_csrf_trusted_origins() -> list[str]:
    origins: list[str] = []
    seen: set[str] = set()
    for origin in CORS_ALLOWED_ORIGINS:
        if origin and origin not in seen:
            origins.append(origin)
            seen.add(origin)
    for host in ALLOWED_HOSTS:
        if not host or host == '*':
            continue
        for scheme in ('http', 'https'):
            origin = f'{scheme}://{host}'
            if origin not in seen:
                origins.append(origin)
                seen.add(origin)
    return origins


CSRF_TRUSTED_ORIGINS = config(
    'CSRF_TRUSTED_ORIGINS',
    default=','.join(_build_default_csrf_trusted_origins()),
    cast=Csv(),
)
CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in CSRF_TRUSTED_ORIGINS if o and o.strip()
]


def _discover_private_ipv4_addresses() -> list[str]:
    addresses: set[str] = set()

    try:
        hostname = socket.gethostname()
        for address in socket.gethostbyname_ex(hostname)[2]:
            if address and not address.startswith('127.'):
                addresses.add(address)
    except Exception:
        pass

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(('8.8.8.8', 80))
            address = probe.getsockname()[0]
            if address and not address.startswith('127.'):
                addresses.add(address)
    except Exception:
        pass

    return sorted(addresses)


if ALLOW_LAN_DEV_ORIGINS and (DEBUG or USE_SQLITE):
    for lan_host in _discover_private_ipv4_addresses():
        if lan_host not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(lan_host)
        for port in ('4000', '5050'):
            lan_origin = f'http://{lan_host}:{port}'
            if lan_origin not in CORS_ALLOWED_ORIGINS:
                CORS_ALLOWED_ORIGINS.append(lan_origin)

    CORS_ALLOWED_ORIGIN_REGEXES = [
        r'^https?://(localhost|127\.0\.0\.1)(:\d+)?$',
        r'^https?://192\.168\.\d+\.\d+(:\d+)?$',
        r'^https?://10\.\d+\.\d+\.\d+(:\d+)?$',
        r'^https?://172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+(:\d+)?$',
    ]

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
}

# JWT
# Access/refresh durations are configured in minutes via env.
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=config('JWT_ACCESS_TOKEN_LIFETIME', default=30, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(minutes=config('JWT_REFRESH_TOKEN_LIFETIME', default=10080, cast=int)),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# File Storage
STORAGE_ROOT = Path(config('STORAGE_ROOT', default=str(BASE_DIR / 'storage')))
MAX_UPLOAD_SIZE = config('MAX_UPLOAD_SIZE', default=52428800, cast=int)  # 50MB
FILE_UPLOAD_MAX_MEMORY_SIZE = MAX_UPLOAD_SIZE

# App settings
APP_NAME = config('APP_NAME', default='HelioGram')
DEFAULT_LOCALE = config('DEFAULT_LOCALE', default='en')

# Email
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = True

# ---------------------------------------------------------------------------
# Security hardening (production only).
# These settings apply when DEBUG=False so local dev (HTTP on localhost) keeps
# working as before. Each flag can still be overridden via env if the deploy
# sits behind a specific proxy / TLS setup.
# ---------------------------------------------------------------------------
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = parse_bool(
        config('SESSION_COOKIE_SECURE', default='True'), default=True,
    )
    CSRF_COOKIE_SECURE = parse_bool(
        config('CSRF_COOKIE_SECURE', default='True'), default=True,
    )
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = 'same-origin'
    X_FRAME_OPTIONS = 'DENY'
    SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=0, cast=int)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = parse_bool(
        config('SECURE_HSTS_INCLUDE_SUBDOMAINS', default='False'), default=False,
    )
    SECURE_HSTS_PRELOAD = parse_bool(
        config('SECURE_HSTS_PRELOAD', default='False'), default=False,
    )



