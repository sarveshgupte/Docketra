# Use official Node.js 20 LTS slim image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application source code (excluding ignored files in .dockerignore)
COPY src/ ./src/

# Set production environment defaults
ENV NODE_ENV=production
ENV PORT=8080

# Expose port (Cloud Run sets PORT automatically, typically 8080)
EXPOSE 8080

# Start the API web service
CMD ["node", "src/server.js"]
