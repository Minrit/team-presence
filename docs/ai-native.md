# team-presence AI-native usage

team-presence is a hosted service with a browser dashboard, HTTP API, WebSocket
collector ingest, and a Streamable HTTP MCP endpoint at `/mcp`.

The intended split is:

- Hosted service: PM operations and MCP tools.
- Laptop collector: login, local hooks, local session capture, diagnostics.
- Agents and skills: connect to the hosted `/mcp`; they should not spawn a
  local MCP server in normal use.

## Architecture

```text
AI agent / skill
  -> remote MCP over HTTP: https://<server>/mcp
  -> team-presence server
  -> Postgres/Redis + activity actor_type=agent

Browser
  -> same server HTTP API/SSE
  -> activity actor_type=user

Laptop collector CLI
  -> login, hooks, OpenCode/Claude capture
  -> /ws/collector
```

## New Laptop Flow

```bash
curl -fsSL https://<team-presence-server>/install.sh | sh
team-presence login --server https://<team-presence-server> --email <you>
team-presence mcp-config
team-presence install-hooks
team-presence start --agent opencode
```

`install.sh` downloads `team-presence-{os}-{arch}`, verifies sha256 from
`/download/manifest.json`, and installs it to `~/.local/bin/team-presence` by
default. macOS and Linux are supported for arm64/aarch64 and x86_64.

Use the endpoint and Authorization header printed by `team-presence mcp-config`
in your MCP-capable client. The config contains a Bearer collector token, so
treat it like a password.

For production hardening, set `TP_MCP_ALLOWED_HOSTS` to a comma-separated list
of accepted Host values. When it is unset, the hosted `/mcp` endpoint accepts
non-local service hostnames and relies on Bearer auth.

## Remote MCP Tools

The hosted `/mcp` endpoint exposes server-side PM tools:

- Story: `tp_story_list`, `tp_story_get`, `tp_story_create`,
  `tp_story_edit`, `tp_story_move_status`, `tp_story_claim`,
  `tp_story_delete`
- Acceptance criteria: `tp_ac_add`, `tp_ac_check`, `tp_ac_uncheck`,
  `tp_ac_edit`, `tp_ac_remove`
- Comments: `tp_comment_create`, `tp_comment_list`
- Relations: `tp_relation_block`, `tp_relation_unblock`,
  `tp_relation_list`
- Activity: `tp_activity_list`
- Sprints: `tp_sprint_list`, `tp_sprint_create`, `tp_sprint_edit`
- Epics: `tp_epic_list`, `tp_epic_create`, `tp_epic_edit`
- Identity: `tp_whoami`

Collector-local operations are intentionally not MCP tools anymore. Run them
directly with the CLI:

```bash
team-presence status
team-presence doctor
team-presence install-hooks
team-presence uninstall-hooks
team-presence mute
team-presence unmute
```

## Contributors

```bash
docker compose up -d postgres redis
cargo run --bin server
cd web && pnpm install && pnpm dev
```

Build release collector artifacts:

```bash
bash scripts/build-release-binaries.sh
```

The legacy `crates/tp-mcp` stdio bridge remains in the tree for transition and
comparison, but it is no longer the onboarding or release path.

## Troubleshooting

| Symptom | Fix |
|---|---|
| MCP client gets 401 | Re-run `team-presence login`, then update the Bearer header from `team-presence mcp-config`. |
| MCP client cannot reach `/mcp` | Verify the configured URL is the hosted server URL plus `/mcp`, not a local `tp-mcp` command. |
| Stream page is empty | Run `team-presence start --agent opencode` and check `team-presence doctor`. |
| OpenCode DB unreadable | Follow the `fix:` line from `team-presence doctor`. |
| macOS blocks the downloaded binary | Run `xattr -d com.apple.quarantine ~/.local/bin/team-presence` once. |
