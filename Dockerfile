FROM node:20-slim

# Install standard dependencies for Puppeteer, FFmpeg, and Xvfb on Debian
RUN apt-get update && apt-get install -y \
    ffmpeg \
    chromium \
    xvfb \
    fonts-liberation \
    libnss3 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxkbcommon0 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Set environment variable to trigger Docker-specific logic in the code
ENV DOCKER=true

# Start the bot cleanly inside xvfb-run (shell form avoids CRLF issues)
CMD xvfb-run -a --server-args="-screen 0 1920x1080x24" npx tsx src/browser/init.ts
