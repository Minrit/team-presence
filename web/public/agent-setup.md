# team-presence — Agent Self-Configuration

> **This document is written for AI coding assistants.** If you are a human,
> open `docs/ai-native.md` in the repo instead. If you are an AI that
> fetched this page (e.g. through `WebFetch`, `curl`, a browser tool), you
> can follow the steps verbatim and end up fully wired into the
> team-presence stack — no further human input needed beyond a one-time
> `login` step (§4).

Canonical locations of this file:
- Served: `http://localhost:5173/agent-setup.md` (plain markdown, no JS)
- Also at: `http://localhost:5173/agent-setup` (same content, rendered)
- Source: `team-presence/web/public/agent-setup.md` in the repo

---

## 1. What you are connecting to

| Piece | Where |
|---|---|
| Project | `team-presence` — read-only PM board + live Claude Code sessions for a 6-person team |
| HTTP API | `http://localhost:8080/api/v1/*` (Bearer auth) |
| MCP server | `tp-mcp` (stdio JSON-RPC, 30 tools) |
| Skills | `team-presence/.claude/skills/tp-*/SKILL.md` (7 BMad-style skills) |
| Web UI | `http://localhost:5173` (read-only observation dashboard) |
| Typical repo root | `~/ZStack/ai-native-workspace/team-presence` |

The architecture is: **you talk MCP → tp-mcp → HTTP → server**. The server
stamps every write whose request carries `X-Actor-Kind: agent` as
`story_activity.actor_type='agent'`, so the audit log cleanly separates
human vs agent operations. tp-mcp attaches that header for you.

---

## 2. Build the MCP binary

Find the repo root and build. `tp-mcp` is a workspace member.

```bash
export TP_REPO=$HOME/ZStack/ai-native-workspace/team-presence   # or wherever the repo is
cd $TP_REPO
cargo build -p team-presence-tp-mcp
```

Result: `$TP_REPO/target/debug/tp-mcp`. It's a stdio JSON-RPC server.

If cargo isn't available: ask a human to run the build once. You only
need the binary path; the binary itself has no external runtime deps
beyond whatever dynamic libs the system provides.

---

## 3. Configure yourself as an MCP client

### 3.1 Claude Code (repo-local config; recommended)

Claude Code auto-loads `$TP_REPO/.mcp.json` on workspace open. It already
contains:

```json
{
  "mcpServers": {
    "team-presence": {
      "command": "./target/debug/tp-mcp",
      "args": [],
      "env": { "TP_MCP_LOG": "info" }
    }
  }
}
```

No action needed beyond opening the repo in Claude Code — unless you
want to run from a different working directory, in which case switch the
`command` to an absolute path.

### 3.2 Codex

Add to `~/.codex/config.toml`:

```toml
[mcp.servers.team-presence]
command = "/absolute/path/to/team-presence/target/debug/tp-mcp"
args = []
```

### 3.3 Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "team-presence": {
      "command": "/absolute/path/to/team-presence/target/debug/tp-mcp"
    }
  }
}
```

### 3.4 Gemini CLI / other generic MCP clients

Any client that speaks MCP over stdio will work with:

```
command:    /absolute/path/to/team-presence/target/debug/tp-mcp
args:       []
transport:  stdio
env.TP_MCP_LOG: info
```

### 3.5 No MCP support? Use the HTTP API directly.

All MCP tools are thin wrappers over `/api/v1/*`. You can bypass MCP and
call the HTTP API yourself. **You must** send on every write:

```
Authorization: Bearer <TOKEN>
X-Actor-Kind: agent
Content-Type: application/json
```

See §7 below for the endpoint list, or read
`crates/server/src/lib.rs::build_router` as the authoritative source.

---

## 4. Authenticate

tp-mcp reuses the collector's on-disk credentials. The preferred flow is
to have a human run `team-presence login` once per machine:

```bash
cd $TP_REPO
cargo run --bin team-presence -- login \
    --server http://localhost:8080 \
    --email <your-team-email>
```

This stores a long-lived bearer token in:
- **Primary:** OS keyring (macOS Keychain / libsecret / Windows cred
  manager) under service `io.team-presence.collector`
- **Fallback:** `~/.config/team-presence/credentials.json` (0600 in a
  0700 dir)

tp-mcp reads from either, in that order, at startup.

**Pure-agent alternative:** if you are running in a headless context
without a human, you can call `/api/v1/auth/login` yourself:

```http
POST http://localhost:8080/api/v1/auth/login
Content-Type: application/json

{"email": "<email>", "password": "<password>"}
```

You get back `{ access_token, access_ttl_secs, user }`. Use the
`access_token` as your bearer. Refresh when it expires. Note: this
bypasses the keyring storage, so remember the token in-memory for the
session's duration.

---

## 5. Verify the connection

After your MCP client loads, issue a `tools/list`; you should see 30
tools (see §7). Then run the smoke tool:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"tp_whoami","arguments":{}}}
```

Expected response:

```
email=<your-email> id=<uuid> display_name=<name>
```

If you see `NotLoggedIn`, re-do §4. If the process crashes, check
stderr — tp-mcp logs to stderr (stdout is reserved for JSON-RPC).

---

## 6. Use the skills

Seven skills live at `$TP_REPO/.claude/skills/tp-*/SKILL.md`. Each file
is a self-contained procedural prompt that guides one workflow:

| Skill | What it does |
|---|---|
| `/tp-create-story` | Create a story end-to-end (name → priority → points → epic → sprint → AC loop) |
| `/tp-edit-story` | Diff-style field update on one story |
| `/tp-move-status` | Move a story between the 5 workflow states, with safety checks |
| `/tp-groom-ac` | Check / uncheck / edit / add / remove acceptance criteria |
| `/tp-dev-story` | Primary "做故事" loop — claim → AC → review → done |
| `/tp-plan-sprint` | Create a sprint + bulk-assign stories, with capacity check |
| `/tp-connect-machine` | First-laptop onboarding flow |

**Claude Code** auto-registers these because they live under
`.claude/skills/`. **Other agents**: you have two integration options:

1. **Read on demand.** When a user asks you to do one of these
   workflows, `cat $TP_REPO/.claude/skills/tp-<name>/SKILL.md` and
   execute the body as a procedural prompt.
2. **Inline into your system prompt.** If your framework supports
   slash-commands / skills / composites, ship the SKILL.md bodies as
   native primitives.

All of them are just orchestration over the MCP tools in §7. Nothing in
a skill is required to use team-presence — they are guidance, not gates.

---

## 7. Canonical tool surface (30 tools)

Every write tool adds `X-Actor-Kind: agent` automatically. Indexes are
0-based. Story statuses are: `todo | in_progress | blocked | review | done`.

### Story

| Tool | Semantics |
|---|---|
| `tp_story_list(sprint?, status?, owner?, epic?, priority?)` | List. `sprint` accepts UUID, name, or `latest`. |
| `tp_story_get(id)` | One story + all fields. |
| `tp_story_create(name, description?, priority?, points?, epic?, sprint?, branch?, pr_ref?)` | Create. `epic`/`sprint` accept UUID or name. |
| `tp_story_edit(id, {name?, description?, priority?, points?, epic?, sprint?, branch?, pr_ref?})` | Partial update. |
| `tp_story_move_status(id, status)` | Status transition. |
| `tp_story_claim(id)` | Sets owner = self, status = in_progress. |
| `tp_story_delete(id)` | Cascade deletes AC / comments / activity. |

### Acceptance criteria

| Tool | Semantics |
|---|---|
| `tp_ac_add(story_id, text)` | Append `{text, done:false}`. |
| `tp_ac_check(story_id, index)` | Mark index done. |
| `tp_ac_uncheck(story_id, index)` | Mark index not done. |
| `tp_ac_edit(story_id, index, text)` | Rewrite the text. |
| `tp_ac_remove(story_id, index)` | Remove one item. |

### Comments / relations / activity

| Tool | Semantics |
|---|---|
| `tp_comment_create(story_id, body)` | Post a comment + activity row. |
| `tp_comment_list(story_id)` | List comments oldest-first. |
| `tp_relation_block(from_id, to_id)` | Assert from blocks to. |
| `tp_relation_unblock(from_id, to_id)` | Remove that relation. |
| `tp_relation_list(story_id)` | `{blocks, blocked_by}`. |
| `tp_activity_list(story_id, limit?)` | Newest-first, default limit 50. |

### Sprint / epic

| Tool | Semantics |
|---|---|
| `tp_sprint_list()` | Every sprint + `{story_count, total_pts, done_pts}`. |
| `tp_sprint_create(name, start_date, end_date)` | YYYY-MM-DD dates. |
| `tp_sprint_edit(id, {name?, start_date?, end_date?})` | Partial update. |
| `tp_epic_list()` | All epics. |
| `tp_epic_create(name, color?, description?)` | color = `#rrggbb`. |
| `tp_epic_edit(id, {name?, color?, description?})` | Partial update. |

### Collector

| Tool | Semantics |
|---|---|
| `tp_collector_status()` | Login / mute / socket state. |
| `tp_collector_install_hooks(force?)` | Drop Claude Code hook scripts into `~/.claude/hooks/`. |
| `tp_collector_uninstall_hooks()` | Reverse of install. |
| `tp_collector_mute()` | Stop streaming session_content frames. |
| `tp_collector_unmute()` | Resume. |

### Identity

| Tool | Semantics |
|---|---|
| `tp_whoami()` | Returns authenticated user email + UUID + display name. |

---

## 8. Invariants to respect

- **Audit**: every write must carry `X-Actor-Kind: agent`. tp-mcp sends
  it automatically; do not strip it if you proxy.
- **AC indexes** are 0-based at the MCP boundary. If you show 1-based
  to humans, translate.
- **Status** is strict. Server rejects anything outside the 5-value set.
- **Concurrency**: AC operations are read-modify-write on the JSONB
  array; last-write-wins. If you race with another agent, the later
  write overwrites the earlier. For a 6-person team this is fine.
- **Activity log** is append-only. You cannot delete audit rows via
  any public endpoint. Respect that — do not try to "undo" by munging.

---

## 9. Minimum viable "hello world"

After building + authenticating, this sequence should succeed:

```jsonc
// 1. handshake
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"<you>","version":"0"}}}

// 2. acknowledge
{"jsonrpc":"2.0","method":"notifications/initialized"}

// 3. list tools
{"jsonrpc":"2.0","id":2,"method":"tools/list"}

// 4. smoke-test
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"tp_whoami","arguments":{}}}

// 5. list your own assigned stories in the current sprint
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"tp_story_list","arguments":{"sprint":"latest"}}}
```

If step 4 says `email=<your-email>`, you are connected. Start doing work
by calling `tp_story_claim` on an unassigned todo, or run the
`/tp-dev-story` skill.

---

## 10. Further reading

- `$TP_REPO/docs/ai-native.md` — human-written usage guide, overlaps
  heavily with this file.
- `$TP_REPO/docs/plans/2026-04-18-009-feat-team-presence-ai-native-mcp-plan.md`
  — implementation history.
- `$TP_REPO/crates/tp-mcp/src/server.rs` — source of truth for tool
  definitions and JSON schemas.
- `$TP_REPO/crates/server/src/lib.rs::build_router` — HTTP surface.

---

*This file is versioned with the repo. If you found it stale, re-fetch
from `team-presence/web/public/agent-setup.md` on the default branch.*
