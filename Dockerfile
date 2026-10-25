# Production Dockerfile for Render / Cloud deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY backend/package*.json ./
RUN npm ci

# Copy TypeScript config and source files
COPY backend/tsconfig.json ./
COPY backend/src ./src

# Build TypeScript to JavaScript in /dist
RUN npm run build

# Production runner image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

# Install Redis server and client inside container
RUN apk add --no-cache redis

# Copy package files and install production dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Copy entrypoint script to launch Redis if needed
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 10000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
