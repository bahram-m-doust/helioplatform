# Build from repo root with context `agents/`:
#   docker build -f campaign-maker/frontend/Dockerfile -t helio-campaign-maker-frontend agents
FROM node:20-alpine AS build
COPY shared-ui /app/shared-ui
COPY campaign-maker/frontend /app/campaign-maker/frontend
WORKDIR /app/campaign-maker/frontend
RUN npm install && npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/campaign-maker/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
