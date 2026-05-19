# Build stage — compiles native better-sqlite3 addon
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Runtime stage
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY server.js ./
COPY src/ ./src/
COPY public/ ./public/

ENV PORT=3000
ENV DB_PATH=/app/data/youtv.db

EXPOSE 3000

# Create data dir and give ownership to the node user before switching to it
RUN mkdir -p /app/data && chown -R node:node /app/data

# Persist the SQLite database across container restarts
VOLUME ["/app/data"]

USER node

CMD ["node", "server.js"]
