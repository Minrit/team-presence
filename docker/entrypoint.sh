#!/usr/bin/env bash
# Entrypoint for the all-in-one team-presence image.
#
# Boots PostgreSQL and Redis as background processes inside the container,
# bootstraps the application role / database on first run, then runs the
# Axum server in the foreground. If any of the three processes dies the
# whole container exits — Docker / Kubernetes will restart it cleanly.

set -euo pipefail

PG_BIN=/usr/lib/postgresql/15/bin
PGDATA="${PGDATA:-/var/lib/team-presence/pg}"
REDIS_DATA="${REDIS_DATA:-/var/lib/team-presence/redis}"
PG_USER="${PG_USER:-tp}"
PG_PASSWORD="${PG_PASSWORD:-tp}"
PG_DB="${PG_DB:-team_presence}"

log() { printf '[entrypoint] %s\n' "$*" >&2; }

# Make sure the data directories exist with the right ownership. This is
# important when the volume is brand-new (root-owned by Docker).
mkdir -p "$PGDATA" "$REDIS_DATA" /var/run/postgresql
chown -R postgres:postgres "$PGDATA" /var/run/postgresql
chown -R redis:redis        "$REDIS_DATA"

# ---------- PostgreSQL ----------
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  log "initialising postgres data dir at $PGDATA"
  gosu postgres "$PG_BIN/initdb" \
        --pgdata="$PGDATA" \
        --username=postgres \
        --auth-host=md5 \
        --auth-local=trust \
        --encoding=UTF8 \
        --no-locale >/dev/null
  cat >> "$PGDATA/postgresql.conf" <<'EOF'
listen_addresses = '127.0.0.1'
unix_socket_directories = '/var/run/postgresql,/tmp'
shared_buffers = 128MB
max_connections = 100
EOF
fi

log "starting postgres"
gosu postgres "$PG_BIN/postgres" -D "$PGDATA" \
    -c config_file="$PGDATA/postgresql.conf" \
    >/var/log/postgres.log 2>&1 &
PG_PID=$!

# Wait for pg to accept connections.
for _ in $(seq 1 30); do
  if gosu postgres "$PG_BIN/pg_isready" -h /var/run/postgresql -q; then
    break
  fi
  sleep 1
done
if ! gosu postgres "$PG_BIN/pg_isready" -h /var/run/postgresql -q; then
  log "postgres did not become ready in 30s; tail of log:"
  tail -n 50 /var/log/postgres.log >&2 || true
  exit 1
fi

# Bootstrap the application role + database (idempotent).
PSQL="gosu postgres $PG_BIN/psql -h /var/run/postgresql -v ON_ERROR_STOP=1"
if ! $PSQL -tAc "SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'" | grep -q 1; then
  log "creating role ${PG_USER}"
  $PSQL -c "CREATE ROLE ${PG_USER} LOGIN PASSWORD '${PG_PASSWORD}' CREATEDB"
fi
if ! $PSQL -tAc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" | grep -q 1; then
  log "creating database ${PG_DB}"
  $PSQL -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER}"
fi

# ---------- Redis ----------
log "starting redis"
gosu redis /usr/bin/redis-server \
    --appendonly yes \
    --dir "$REDIS_DATA" \
    --bind 127.0.0.1 \
    --port 6379 \
    --daemonize no \
    >/var/log/redis.log 2>&1 &
REDIS_PID=$!

# ---------- Server ----------
shutdown() {
  log "shutting down"
  if [ -n "${SERVER_PID:-}" ]; then kill -TERM "$SERVER_PID" 2>/dev/null || true; fi
  if [ -n "${REDIS_PID:-}"  ]; then kill -TERM "$REDIS_PID"  2>/dev/null || true; fi
  gosu postgres "$PG_BIN/pg_ctl" stop -D "$PGDATA" -m fast >/dev/null 2>&1 || true
  wait 2>/dev/null || true
}
trap shutdown TERM INT

log "starting team-presence server on ${BIND_ADDR}"
cd /opt/team-presence
./server &
SERVER_PID=$!

# Block on whichever child exits first; propagate its exit code.
set +e
wait -n "$PG_PID" "$REDIS_PID" "$SERVER_PID"
EXIT_CODE=$?
log "child process exited with code ${EXIT_CODE} — terminating container"
shutdown
exit "$EXIT_CODE"
