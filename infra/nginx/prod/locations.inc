# Shared proxy rules for the helio-platform edge.
#
# Included from BOTH the port-80 default_server (IP fallback) and the
# port-443 TLS server (platform.helio.ae) so the routing definition stays
# in one place. Do NOT define `listen` / `server_name` / `ssl_*` here —
# those belong to the individual server blocks in nginx.conf.
#
# Routing map (public URL -> upstream):
#   /                           -> main-app-frontend
#   /heliogram/                 -> heliogram-frontend
#   /api/realtime/events/       -> heliogram-backend (SSE, buffering OFF)
#   /api/image/                 -> image-generator-api  (rewritten to /api/)
#   /api/video/                 -> video-generator-api  (rewritten to /api/)
#   /api/campaign/              -> campaign-maker-api   (rewritten to /api/)
#   /api/storyteller/           -> storyteller-api      (rewritten to /api/)
#   /api/                       -> heliogram-backend (catch-all)
#   /admin/, /static/, /media/  -> heliogram-backend
#   /.well-known/acme-challenge/-> /var/www/certbot (Let's Encrypt webroot)

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

# ---- Server-Sent Events (must be first, more specific than /api/) ----
location /api/realtime/events/ {
  proxy_pass http://heliogram_backend/api/realtime/events/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Connection "";

  proxy_buffering off;
  proxy_cache off;
  chunked_transfer_encoding off;
  proxy_read_timeout 24h;
}

# ---- AI agent microservices ----
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

# ---- HelioGram backend (catch-all API + admin + static/media) ----
location /api/ {
  proxy_pass http://heliogram_backend;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /admin/ {
  proxy_pass http://heliogram_backend;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /static/ {
  proxy_pass http://heliogram_backend;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  expires 30d;
  add_header Cache-Control "public, max-age=2592000";
}

location /media/ {
  proxy_pass http://heliogram_backend;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
}

# ---- HelioGram community SPA (served under /heliogram) ----
location /heliogram/ {
  proxy_pass http://heliogram_frontend/heliogram/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
location = /heliogram {
  return 301 /heliogram/;
}

# ---- main-app SPA (default) ----
location / {
  proxy_pass http://main_app;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
