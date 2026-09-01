FROM node:24-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev


FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY db/schema.sql ./db/schema.sql

ENV DB_PATH=/data/goobie.db
RUN mkdir -p /data && chown node:node /data

USER node

# node's --env-file rather than compose's env_file: node strips trailing
# `# comments` from values and .env.example puts one on CHANNEL_ID
CMD ["node", "--env-file=/app/.env", "src/index.ts"]
