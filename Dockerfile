FROM node:20-slim

# Install ffmpeg and sqlite dependencies
RUN apt-get update && apt-get install -y ffmpeg python3 make g++ sqlite3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the Next.js application
RUN npm run build

# Move initial data and uploads to a safe place so they aren't hidden by volume mounts
RUN mkdir -p /app/init-data /app/init-uploads && \
    if [ -d /app/data ]; then cp -r /app/data/* /app/init-data/ 2>/dev/null || true; fi && \
    if [ -d /app/uploads ]; then cp -r /app/uploads/* /app/init-uploads/ 2>/dev/null || true; fi

# Define volumes for persistent data
VOLUME ["/app/data", "/app/uploads"]

# Expose the requested port
ENV PORT=7575
EXPOSE 7575

# Start the custom server
CMD ["npm", "start"]
