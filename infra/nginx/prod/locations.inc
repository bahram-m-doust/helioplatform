# Shared proxy rules for the helio-platform edge.
#
# Included from BOTH the port-80 default_server (IP fallback) and the
# port-443 TLS server (api.helio.ae) so the routing definition stays
# in one place. Do NOT define `listen` / `server_name` / `ssl_*` here —
# those belong to the individual server blocks in nginx.conf.
#
# Routing map (public URL -> upstream):
#   /                           -> per-host root SPA (see ``map`` in nginx.conf)
#   /api/image/                 -> image-generator-api      (rewritten to /api/)
#   /api/video/                 -> video-generator-api      (rewritten to /api/)
#   /api/storyteller/           -> storyteller-api          (rewritten to /api/)
#   /api/campaign/              -> campaign-maker-api       (rewritten to /api/)
#   /api/soul-print/            -> soul-print-api           (rewritten to /api/)
#   /v1/<agent>/                -> <agent>-api              (PUBLIC, X-API-Key)
#   /api/tenant/                -> tenant-api               (Supabase JWT)
#   /.well-known/acme-challenge/-> /var/www/certbot         (Let's Encrypt webroot)

client_max_body_size 50M;

proxy_read_timeout 300s;
proxy_send_timeout 300s;
proxy_connect_timeout 30s;

# ACME HTTP-01 challenge. certbot (running on the host) writes tokens to
# /var/www/certbot/.well-known/acme-challenge/<token>; this container has
# that path bind-mounted read-only, so nginx can serve the response while
# the nginx itself keeps running — zero downtime on renewal.
location /.well-known/acme-challenge/ {
  root /var/www/certbot;
  default_type "text/plain";
  access_log off;
  try_files $uri =404;
}

# ---- AI agent microservices (internal: /api/<agent>/...) ----
# Reached by the same-origin admin SPA through nginx; the upstream
# FastAPI services listen only on the docker network so they are never
# directly exposed to the public internet.
location /api/image/ {
  rewrite ^/api/image(/.*)$ $1 break;
  proxy_pass http://image_agent;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /api/video/ {
  rewrite ^/api/video(/.*)$ $1 break;
  proxy_pass http://video_agent;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /api/campaign/ {
  rewrite ^/api/campaign(/.*)$ $1 break;
  proxy_pass http://campaign_agent;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /api/storyteller/ {
  rewrite ^/api/storyteller(/.*)$ $1 break;
  proxy_pass http://storyteller_agent;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /api/soul-print/ {
  rewrite ^/api/soul-print(/.*)$ $1 break;
  proxy_pass http://soul_print_agent;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

# ---- Public/external API surface (third-party callers, e.g. Framer) ----
# Each agent has its own /v1/<slug>/* prefix. nginx applies a per-IP rate
# limit (defense in depth) and the agent enforces an X-API-Key + per-key
# bucket. We strip the agent slug so /v1/image/generate -> /v1/generate
# upstream, which is what each FastAPI external router matches.
location /v1/image/ {
  limit_req zone=helio_external burst=30 nodelay;
  rewrite ^/v1/image(/.*)$ /v1$1 break;
  proxy_pass http://image_agent;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /v1/video/ {
  limit_req zone=helio_external burst=30 nodelay;
  rewrite ^/v1/video(/.*)$ /v1$1 break;
  proxy_pass http://video_agent;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /v1/storyteller/ {
  limit_req zone=helio_external burst=30 nodelay;
  rewrite ^/v1/storyteller(/.*)$ /v1$1 break;
  proxy_pass http://storyteller_agent;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /v1/campaign/ {
  limit_req zone=helio_external burst=30 nodelay;
  rewrite ^/v1/campaign(/.*)$ /v1$1 break;
  proxy_pass http://campaign_agent;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /v1/soul-print/ {
  limit_req zone=helio_external burst=30 nodelay;
  rewrite ^/v1/soul-print(/.*)$ /v1$1 break;
  proxy_pass http://soul_print_agent;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

# ---- tenant-api (Supabase-backed control plane) ----
# Browser callers send a Supabase JWT; tenant-api validates against JWKS.
# Strip the /api/tenant prefix so upstream sees the route as it's defined
# in services/tenant-api/app/routes/* (e.g. /me/brands, /admin/brands).
location /api/tenant/ {
  rewrite ^/api/tenant(/.*)$ $1 break;
  proxy_pass http://tenant_api;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

# ---- Root SPA (per-host) ----
# ``$root_upstream`` is set by the ``map`` block in nginx.conf:
#   api.helio.ae / IP fallback -> main_app
#   admin.helio.ae             -> admin_frontend
# This keeps a single locations.inc included from every server block.
location / {
  proxy_pass http://$root_upstream;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
