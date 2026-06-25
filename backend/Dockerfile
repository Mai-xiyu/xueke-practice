FROM node:22-alpine

WORKDIR /app
COPY server.js /app/server.js

ENV NODE_ENV=production
ENV PORT=3000
ENV SESSION_DATA_DIR=/data

RUN mkdir -p /data

EXPOSE 3000
CMD ["node", "server.js"]
