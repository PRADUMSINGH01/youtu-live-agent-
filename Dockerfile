# ----------------------------------------------------
# Stage 1: Build TypeScript to JavaScript
# ----------------------------------------------------
FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# ----------------------------------------------------
# Stage 2: Production runtime image
# ----------------------------------------------------
FROM node:24-bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/agent/utils/live-stream.js"]