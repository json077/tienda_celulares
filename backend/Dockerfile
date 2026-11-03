# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS runtime

# Oracle clients are required: MariaDB clients do not support all backup flags.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && curl -fsSL https://repo.mysql.com/RPM-GPG-KEY-mysql-2025 \
       | gpg --dearmor -o /usr/share/keyrings/mysql.gpg \
    && echo 'deb [signed-by=/usr/share/keyrings/mysql.gpg] https://repo.mysql.com/apt/debian/ bookworm mysql-8.4-lts' > /etc/apt/sources.list.d/mysql.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends mysql-community-client \
    && mysql --version && mysqldump --version \
    && apt-get purge -y --auto-remove curl gnupg \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production PORT=3000
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node backend/src ./src
COPY --chown=node:node backend/docker/healthcheck.js ./docker/healthcheck.js
# Docker populates new named volumes with these writable directory permissions.
RUN mkdir -p /data/product-photos /app/backend/private/profile-photos /app/backend/private/respaldos \
    && chown -R node:node /data /app/backend/private
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD ["node", "docker/healthcheck.js"]
CMD ["node", "src/server.js"]
