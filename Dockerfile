FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Runtime-only source tree (API + workers + jobs all live under src/)
COPY src ./src

EXPOSE 8080
CMD ["npm", "run", "start:api"]
