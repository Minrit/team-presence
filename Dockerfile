# syntax=docker/dockerfile:1.6
#
# All-in-one team-presence image.
#
# Bundles: PostgreSQL 15 + Redis 7 + Axum API server + built React SPA.
# Externally exposes a single TCP port (4006).
#
# Persistence: mount /var/lib/team-presence to keep DB + Redis state across
# container restarts. Without a volume, data lives in the container's
# writable layer and is lost when the container is removed.
#
# Build:   docker build -t team-presence:latest .
# Run:     docker run -d --name team-presence \
#            -p 4006:4006 \
#            -v tp_data:/var/lib/team-presence \
#            -e JWT_SECRET="$(openssl rand -hex 32)" \
#            team-presence:latest

# ---------- Stage 1: build the web SPA ----------
FROM node:20-bookworm-slim AS web-builder
WORKDIR /web
RUN corepack enable
COPY web/package.json web/pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm build

# ---------- Stage 2: build the Rust server ----------
FROM rust:1.88-bookworm AS server-builder
WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release -p team-presence-server --bin server && \
    cp target/release/server /server

# ---------- Stage 3: runtime ----------
FROM debian:bookworm-slim AS runtime
ENV DEBIAN_FRONTEND=noninteractive

# postgresql-15 and redis-server bring everything we need.
# gosu drops privileges cleanly inside the entrypoint without the SIGTERM
# weirdness of `su -c`.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
         postgresql-15 \
         redis-server \
         ca-certificates \
         gosu \
         curl \
         tini \
    && rm -rf /var/lib/apt/lists/*

# Where everything lives. /var/lib/team-presence is the volume mount point.
RUN mkdir -p /opt/team-presence \
             /var/lib/team-presence \
             /var/run/postgresql \
    && chown postgres:postgres /var/run/postgresql /var/lib/team-presence

COPY --from=server-builder /server               /opt/team-presence/server
COPY --from=web-builder    /web/dist             /opt/team-presence/web
COPY downloads/                                   /opt/team-presence/downloads/
COPY docker/entrypoint.sh                         /opt/team-presence/entrypoint.sh
RUN chmod +x /opt/team-presence/entrypoint.sh

ENV BIND_ADDR=0.0.0.0:4006 \
    DATABASE_URL=postgres://tp:tp@127.0.0.1:5432/team_presence \
    REDIS_URL=redis://127.0.0.1:6379 \
    WEB_DIST_DIR=/opt/team-presence/web \
    TP_DOWNLOADS_DIR=/opt/team-presence/downloads \
    PGDATA=/var/lib/team-presence/pg \
    REDIS_DATA=/var/lib/team-presence/redis \
    RUST_LOG=info,team_presence_server=info

EXPOSE 4006
VOLUME ["/var/lib/team-presence"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://127.0.0.1:4006/health || exit 1

# tini reaps zombie children that postgres / redis may leave behind, and
# forwards SIGTERM into the entrypoint so graceful shutdown works.
ENTRYPOINT ["/usr/bin/tini", "--", "/opt/team-presence/entrypoint.sh"]
