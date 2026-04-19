# team-presence

Internal team tool: **live board** of teammates' active Claude Code
sessions + stories. Two first-class write paths share one HTTP API:

- The browser dashboard — full CRUD on stories / AC / comments / epics /
  sprints / relations. Only live Claude session streams (Stream / Room /
  CurrentStory's right pane) stay read-only because they're collector
  telemetry.
- The `tp-mcp` MCP server — seven `/tp-*` skills (Create/Edit/Move/Groom/
  Dev/Plan-sprint/Connect-machine) let agents drive the same workflows.

Activity log distinguishes the two via `actor_type` (`user` vs `agent`).

**Status:** full UI lifecycle CRUD landed on top of the AI-native MCP
layer (plans 009 → 002). See [`docs/ai-native.md`](docs/ai-native.md)
for the full usage guide.

## Quick start (multi-service dev)

Requires Docker Compose + a recent Rust toolchain (only for the collector build).

```bash
docker compose up -d postgres redis server
curl http://localhost:8080/health    # -> ok
```

The collector (installed on each developer's laptop) is built from
`crates/collector` and distributed separately — see Unit 6 in the plan.

## Production deployment (single Docker image, port 4006)

Postgres 15 + Redis 7 + the Axum API + the built React SPA are all
bundled into one image (`Dockerfile`). Only TCP **4006** is exposed.

```bash
# Build
docker build -t team-presence:latest .

# Run (data persists in the named volume)
docker run -d --name team-presence \
  -p 4006:4006 \
  -v tp_data:/var/lib/team-presence \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  team-presence:latest

curl http://localhost:4006/health    # -> ok
open  http://localhost:4006/         # SPA, served on the same port
```

Or via Compose (auto-builds, restart-on-crash, healthcheck wired):

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
docker compose -f docker-compose.prod.yml up -d --build
```

First boot bootstraps the admin via `POST /api/v1/auth/bootstrap`;
subsequent attempts return 403. The volume at `/var/lib/team-presence`
is the single durable location for the Postgres data dir and the Redis
AOF — back that up and you've backed up the whole service.

## Scope (MVP)

- Minimal story/task Kanban (Todo / Doing / Done).
- Live text streaming Grid of teammates' **claude code** sessions (via
  `~/.claude/projects/<id>/history.jsonl` tail).
- One-shot bmad markdown importer.

**Explicit non-goals:** OpenCode capture (Phase 2), content redaction
(Phase 2), role tiers (everyone admin), multi-workspace, permanent archive.

## Layout

```
crates/
  server/          Axum HTTP + WebSocket + SSE server
  collector/       Single-binary laptop collector
  shared-types/    Wire-format types (shared)
web/               Vite + React frontend
```
