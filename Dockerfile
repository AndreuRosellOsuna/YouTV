# Build stage — compiles native better-sqlite3 addon
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev

# Runtime stage
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY server.js ./
COPY src/ ./src/
COPY public/ ./public/

ENV PORT=3000
ENV DB_PATH=/app/data/youtv.db

EXPOSE 3000

# Persist the SQLite database across container restarts
VOLUME ["/app/data"]

USER node

CMD ["node", "server.js"]
