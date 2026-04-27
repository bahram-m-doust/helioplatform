# syntax=docker/dockerfile:1.6
# Edge nginx image for production. Stateless — all it carries is the config
# from this directory. Rebuild only when the config changes.
FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf \
 && mkdir -p /etc/nginx/snippets

COPY nginx.conf     /etc/nginx/conf.d/default.conf
COPY locations.inc  /etc/nginx/snippets/locations.inc

# Note: we intentionally do NOT run `nginx -t` at build time. The upstream
# blocks reference docker-network hostnames (image-generator-api, tenant-api,
# admin-frontend, ...) that only resolve at runtime, and some nginx versions
# fail the config test when those names are unresolvable.

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
