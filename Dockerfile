# ============================================
# Build Stage
# ============================================
FROM node:20-slim AS builder

# Install build-time system dependencies only
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install ALL dependencies (dev + production)
RUN npm install

# Copy source code
COPY . .

# Build the Next.js application
RUN npm run build

# Prune devDependencies so only production node_modules remain
RUN npm prune --production

# Prepare initial data/uploads (these will be copied to production stage)
RUN mkdir -p /app/init-data /app/init-uploads && \
    if [ -d /app/data ]; then \
        cp -r /app/data/* /app/init-data/ 2>/dev/null || true; \
    fi && \
    if [ -d /app/uploads ]; then \
        cp -r /app/uploads/* /app/init-uploads/ 2>/dev/null || true; \
    fi

# ============================================
# Production Stage
# ============================================
FROM node:20-slim AS runner

# Install only runtime system dependencies (no build tools)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy everything from builder stage (includes pruned production node_modules)
COPY --from=builder /app /app

# Define volumes for persistent data
VOLUME ["/app/data", "/app/uploads"]

# Environment & port
ENV PORT=7575
EXPOSE 7575

# Start the custom server
CMD ["npm", "start"]
