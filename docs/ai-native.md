# team-presence — AI-native usage

team-presence is a read-only observation dashboard plus an MCP-driven
toolchain. The browser shows the board; Claude Code (or any MCP client)
does the work.

## Architecture at a glance

```
┌──────────────────┐       stdio JSON-RPC       ┌──────────┐
│   Claude Code    │ ───────────────────────────│  tp-mcp  │
│ (/tp-* skills)   │                            │  server  │
└──────────────────┘                            └────┬─────┘
                                                     │ HTTP (bearer + X-Actor-Kind:agent)
                                                     ▼
┌──────────────────┐       SSE + REST            ┌──────────┐
│   Browser UI     │ ────────────────────────────│  server  │  ← Axum + Postgres + Redis
│ (read-only)      │                             └──────────┘
└──────────────────┘
```

## Quick start

### Users (new laptop, you just want to drive team-presence from Claude Code)

```bash
# One-line install of the tp-mcp binary. Replace the URL with whatever
# your team's server is reachable at.
curl -fsSL http://<team-presence-server>/install.sh | sh

# Then in Claude Code, run /tp-connect-machine — the skill walks you
# through login + hooks + collector daemon.
```

The installer fetches `tp-mcp-{os}-{arch}` (darwin arm64/x86_64, linux
arm64/x86_64), verifies sha256 against the server's manifest, and drops
it at `~/.local/bin/tp-mcp`. Windows is not supported today.

### Contributors (you're editing Rust or web source)

```bash
# 0. Start infra
docker compose up -d postgres redis

# 1. Build + run the HTTP server
cargo build
cargo run --bin server      # :8080

# 2. Build the MCP server binary (debug build, fast)
cargo build -p team-presence-tp-mcp

# 3. Build the web dashboard
cd web && pnpm install && pnpm dev    # :5173

# 4. Log in once
cd ..
cargo run --bin team-presence -- login --server http://localhost:8080 --email you@team.local

# 5. Launch Claude Code in this repo. It auto-loads .mcp.json and spawns
#    the tp-mcp server via stdio; /tp-* skills appear in its palette.

# 6. (Optional) produce the release binaries your server will serve to
#    teammates on /install.sh. Re-run this after every tp-mcp change
#    that needs to land in production:
bash scripts/build-release-binaries.sh
```

## Skills

All live under `.claude/skills/tp-*/SKILL.md`. They call into tp-mcp
tools with no manual tool wiring needed.

| Skill | Purpose |
|---|---|
| `/tp-create-story` | New story, guided field collection + AC loop |
| `/tp-edit-story` | Diff-style edit (name / priority / points / epic / sprint / branch / pr_ref) |
| `/tp-move-status` | 5-state workflow move with safety checks |
| `/tp-groom-ac` | Check / uncheck / edit / add / remove AC |
| `/tp-dev-story` | "做故事" — claim → AC loop → review → done |
| `/tp-plan-sprint` | Create sprint, assign stories, capacity check |
| `/tp-connect-machine` | Onboarding for a new laptop / teammate |

## MCP tool surface

tp-mcp exposes 30 tools (see `cargo run -p team-presence-tp-mcp --bin tp-mcp`
and send `tools/list`, or check `src/server.rs`). High-level groups:

- **Story**: `tp_story_list / get / create / edit / move_status / claim / delete`
- **AC**: `tp_ac_add / check / uncheck / edit / remove`
- **Comment**: `tp_comment_create / list`
- **Relation**: `tp_relation_block / unblock / list`
- **Activity**: `tp_activity_list`
- **Sprint**: `tp_sprint_list / create / edit`
- **Epic**: `tp_epic_list / create / edit`
- **Collector**: `tp_collector_status / install_hooks / uninstall_hooks / mute / unmute`
- **Identity**: `tp_whoami`

Every write carries `X-Actor-Kind: agent`, landing in
`story_activity.actor_type='agent'` so the audit log cleanly separates
human vs MCP-driven edits.

## Authentication

tp-mcp reuses the collector's on-disk credentials:
- **Primary**: macOS Keychain / libsecret / Windows credential manager
  (service `io.team-presence.collector`).
- **Fallback**: `~/.config/team-presence/credentials.json` at 0600 in a
  0700 directory.

A single `team-presence login` call primes both the collector and
tp-mcp. No separate MCP login flow yet (Phase B: MCP elicitation API).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Every tool errors `NotLoggedIn` | Run `team-presence login` |
| Claude Code doesn't see `/tp-*` skills | Restart Claude Code so it rereads `.claude/skills/` + `.mcp.json` |
| MCP spawn fails with `command not found` | `cargo build -p team-presence-tp-mcp` to create `target/debug/tp-mcp` |
| `tp_story_create` errors `sprint 'foo' not found` | Run `/tp-plan-sprint` or `tp_sprint_list` to confirm names |
| `actor_type` always `user` instead of `agent` | Upstream curl / browser call — **not** an MCP call. tp-mcp always sends `X-Actor-Kind: agent` |
| Stream page is empty | Collector not running — `cargo run --bin team-presence -- start` |

## What the browser **does not** do

By design, the dashboard no longer offers:

- Drag-to-move cards (→ `/tp-move-status` / `tp_story_move_status`)
- "Claim" button (→ `/tp-dev-story` / `tp_story_claim`)
- AC checkbox click (→ `/tp-groom-ac` / `tp_ac_check`)
- Comment composer (→ `tp_comment_create`)
- "New" button (→ `/tp-create-story` / `tp_story_create`)
- Workspace switcher, Tweaks FAB, notification bell

Everything above is an MCP tool because the right interaction model is:
a human describes intent, an agent does the ops, the dashboard reflects
reality. The audit log (actor_type=agent rows) is the chain of
accountability.
