FROM node:20-bookworm-slim

# Install FFmpeg, Chromium, dumb-init, Xvfb, fonts, and required graphic libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    chromium \
    dumb-init \
    xvfb \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    ca-certificates \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libasound2 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxkbcommon0 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set Puppeteer & Node environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    DOCKER=true

# Copy package dependencies and install
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Build TypeScript source into dist/
RUN npm run build

# Ensure recordings directory exists
RUN mkdir -p /app/recordings

EXPOSE 5000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Default command: runs the 24/7 live stream broadcaster with zero tsx runtime overhead
CMD ["node", "dist/browser/live_stream.js"]
