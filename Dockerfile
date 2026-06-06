# Use official Node.js 20 LTS slim image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package descriptors
COPY --chown=node:node package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source code (excluding ignored files in .dockerignore)
COPY --chown=node:node src/ ./src/

# Runtime upload temp storage must be writable by the non-root app user.
RUN mkdir -p /app/uploads/private /app/uploads/tmp \
  && chown -R node:node /app

# Set production environment defaults
ENV NODE_ENV=production
ENV PORT=8080

# Expose port (Cloud Run sets PORT automatically, typically 8080)
EXPOSE 8080

# Run as the non-root user provided by the official Node image.
USER node

# Start the API web service
CMD ["node", "src/server.js"]
