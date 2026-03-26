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

# Expose the requested port
ENV PORT=7575
EXPOSE 7575

# Start the custom server #start
CMD ["npm", ".next/standalone/server.js"] 
