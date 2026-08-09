FROM node:20-alpine

# Install FFmpeg and Chromium inside the container
RUN apk update && apk add --no-cache \
    ffmpeg \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Set environment variable to trigger Docker-specific logic in the code
ENV DOCKER=true

# Start the bot directly using tsx since we're using TypeScript directly
CMD ["npx", "tsx", "src/browser/init.ts"]

