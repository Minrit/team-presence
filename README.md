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
- Live text streaming Grid of teammates' Claude Code / OpenCode sessions
  (Claude via `~/.claude/projects/<id>/history.jsonl`, OpenCode via
  `~/.local/share/opencode/opencode.db`).
- One-shot bmad markdown importer.

**Explicit non-goals:** content redaction (Phase 2), role tiers (everyone
admin), multi-workspace, permanent archive.

## OpenCode quick connect

For OpenCode users (recommended), run the collector in OpenCode mode:

```bash
cd <team-presence-repo>
cargo run --bin team-presence -- install-hooks
cargo run --bin team-presence -- start --agent opencode
```

Check local diagnostics any time:

```bash
cargo run --bin team-presence -- status
cargo run --bin team-presence -- doctor
```

`status` / `doctor` include OpenCode-specific fields:

- `agent_mode=opencode`
- `opencode_db_state` (`readable|missing|permission_denied|...`)
- `opencode_last_event_at`

When `opencode_db_state != readable`, follow the `fix:` hint printed by
`doctor`.

### 5-minute onboarding drill

Use this as the acceptance script for a fresh teammate machine:

1. Run installer + login flow (`/tp-connect-machine` or `install.sh` + `tp_collector_login`).
2. Run `cargo run --bin team-presence -- start --agent opencode` in a persistent terminal.
3. Run `cargo run --bin team-presence -- doctor` and confirm:
   - `status: logged_in`
   - `agent_mode: opencode`
   - `opencode_db_state: readable`
   - `doctor: ok`
4. Open `/stream`, trigger one OpenCode tool call, verify terminal tile shows `tool_use` + `tool_result`.

If step 3 passes but step 4 fails, capture the collector stderr and open a bug with the exact `doctor` output.

## Layout

```
crates/
  server/          Axum HTTP + WebSocket + SSE server
  collector/       Single-binary laptop collector
  shared-types/    Wire-format types (shared)
web/               Vite + React frontend
```
