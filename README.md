# team-presence

Internal team tool: live board of teammates' active AI coding sessions,
stories, epics, sprints, comments, relations, and activity.

The service is now the MCP boundary:

- Browser users work through the dashboard and HTTP API.
- Agents connect to the hosted `/mcp` Streamable HTTP endpoint for PM tools.
- The local `team-presence` binary is only the laptop collector and helper CLI:
  login, hooks, OpenCode/Claude session capture, status, doctor, and MCP config
  printing.

Activity log distinguishes humans and agents via `actor_type` (`user` vs
`agent`). Calls through `/mcp` are recorded as agent activity on the server.

See [`docs/ai-native.md`](docs/ai-native.md) and
[`web/public/agent-setup.md`](web/public/agent-setup.md) for onboarding.

## Quick Start

Requires Docker Compose and a recent Rust toolchain.

```bash
docker compose up -d postgres redis server
curl http://localhost:8080/health
```

Install the laptop collector from a running server:

```bash
curl -fsSL http://localhost:8080/install.sh | sh
team-presence login --server http://localhost:8080 --email you@team.local
team-presence mcp-config
team-presence install-hooks
team-presence start --agent opencode
```

Configure your MCP-capable client with the endpoint/header printed by
`team-presence mcp-config`. Do not configure a local `tp-mcp` stdio process for
normal use.

If opening `/mcp` directly in a browser returns 401/unauthorized, that is
expected. `/mcp` is an MCP transport endpoint and requires the Authorization
header printed by `team-presence mcp-config`. Agents should use the
`/tp-connect-machine` skill or fetch `/agent-setup.md` for the login flow.

Set `TP_MCP_ALLOWED_HOSTS=example.com,example.com:443` in deployments that want
an explicit MCP Host allowlist. If unset, `/mcp` accepts hosted service
hostnames and relies on Bearer auth.

## Production Deployment

Postgres 15, Redis 7, the Axum API, hosted `/mcp`, binary downloads, and the
built React SPA are bundled into one image (`Dockerfile`). Only TCP 4006 is
exposed.

```bash
docker build -t team-presence:latest .

docker run -d --name team-presence \
  -p 4006:4006 \
  -v tp_data:/var/lib/team-presence \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  team-presence:latest

curl http://localhost:4006/health
open http://localhost:4006/
```

Or via Compose:

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
docker compose -f docker-compose.prod.yml up -d --build
```

First boot bootstraps the admin via `POST /api/v1/auth/bootstrap`; subsequent
attempts return 403.

## Release Artifacts

The public installer now downloads the collector CLI artifact named
`team-presence-{os}-{arch}` from `/download/manifest.json`.

```bash
bash scripts/build-release-binaries.sh --native-only
```

The legacy `crates/tp-mcp` stdio binary is retained only for transition tests
and development comparison. New onboarding and release builds use the hosted
`/mcp` endpoint plus the `team-presence` collector CLI.

## Layout

```text
crates/
  server/          Axum HTTP + WebSocket + SSE + hosted MCP server
  collector/       Single-binary laptop collector/helper CLI
  tp-mcp/          Legacy local stdio MCP bridge
  shared-types/    Wire-format types
web/               Vite + React frontend
```
