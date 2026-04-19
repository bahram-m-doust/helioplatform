# Build from repo root with context `agents/`:
#   docker build -f video-generator/frontend/Dockerfile -t helio-video-generator-frontend agents
FROM node:20-alpine AS build
COPY shared-ui /app/shared-ui
COPY video-generator/frontend /app/video-generator/frontend
WORKDIR /app/video-generator/frontend
RUN npm install && npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/video-generator/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
