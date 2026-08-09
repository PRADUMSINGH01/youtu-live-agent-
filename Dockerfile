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

# Start the bot using xvfb-run so Chromium thinks there is a physical display
CMD ["xvfb-run", "-s", "-ac -screen 0 1920x1080x24", "npx", "tsx", "src/browser/init.ts"]

