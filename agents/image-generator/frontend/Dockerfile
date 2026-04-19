# Build from repo root with context `agents/`:
#   docker build -f image-generator/frontend/Dockerfile -t helio-image-generator-frontend agents
FROM node:20-alpine AS build
COPY shared-ui /app/shared-ui
COPY image-generator/frontend /app/image-generator/frontend
WORKDIR /app/image-generator/frontend
RUN npm install && npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/image-generator/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
