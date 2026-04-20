# syntax=docker/dockerfile:1.6
# Edge nginx image for production. Stateless — all it carries is the config
# from this directory. Rebuild only when the config changes.
FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Note: we intentionally do NOT run `nginx -t` at build time. The upstream
# blocks reference docker-network hostnames (heliogram-backend, ...) that
# only resolve at runtime, and some nginx versions fail the config test
# when those names are unresolvable.

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
