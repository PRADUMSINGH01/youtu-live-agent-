FROM node:20-alpine

# Install FFmpeg, Chromium, and Xvfb (Virtual Framebuffer for headless rendering)
RUN apk update && apk add --no-cache \
    ffmpeg \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    xvfb

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Set environment variable to trigger Docker-specific logic in the code
ENV DOCKER=true

# Start Xvfb in the background, wait 2 seconds for it to initialize, then start the bot
CMD sh -c "Xvfb :99 -screen 0 1920x1080x24 -ac & export DISPLAY=:99 && sleep 2 && npx tsx src/browser/init.ts"
