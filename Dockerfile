FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts vitest.config.ts ./
COPY src/ ./src/
COPY public/ ./public/
COPY tools/generate-legacy-pages.mjs ./tools/generate-legacy-pages.mjs
COPY *.html ./
RUN npm run build

FROM nginx:alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/

EXPOSE 80
