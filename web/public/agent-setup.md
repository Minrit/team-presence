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
| MCP server | `tp-mcp` (stdio JSON-RPC, 31+ tools) |
| Skills | `team-presence/.claude/skills/tp-*/SKILL.md` (7 BMad-style skills) |
| Web UI | `http://localhost:5173` (read-only observation dashboard) |
| Typical repo root | `~/ZStack/ai-native-workspace/team-presence` |

The architecture is: **you talk MCP → tp-mcp → HTTP → server**. The server
stamps every write whose request carries `X-Actor-Kind: agent` as
`story_activity.actor_type='agent'`, so the audit log cleanly separates
human vs agent operations. tp-mcp attaches that header for you.

### 1.1 One-line install (preferred path)

The team-presence HTTP server ships a pre-compiled `tp-mcp` for the four
supported laptop targets. On a clean machine, this is the whole setup:

```bash
curl -fsSL http://<team-presence-server>/install.sh | sh
```

`http://<team-presence-server>` is whatever URL your admin gave you
(e.g. `http://localhost:8080` for local dev, or an internal hostname).
The installer:

1. Detects your OS / CPU (`uname -s` + `uname -m`).
2. Fetches `/download/manifest.json` and the matching binary from
   `/download/tp-mcp-{os}-{arch}`.
3. Verifies the sha256 against the manifest.
4. Drops the binary at `~/.local/bin/tp-mcp` (override with
   `TP_INSTALL_DIR=…`).
5. Prints a PATH hint if `~/.local/bin` isn't already on `$PATH`.

Supported combinations (R1):

| OS | Architecture | Artifact |
|---|---|---|
| macOS 12+ | Apple Silicon | `tp-mcp-darwin-aarch64` |
| macOS 12+ | Intel | `tp-mcp-darwin-x86_64` |
| Linux | arm64 | `tp-mcp-linux-aarch64` |
| Linux | x86_64 | `tp-mcp-linux-x86_64` |

**Windows is not supported** today — there is no `.exe` artifact and
the credential / keyring path would need a separate port. Open an
issue if you need it.

Environment variables the installer honors:

| Var | Default | Purpose |
|---|---|---|
| `TP_SERVER` | (baked in by the server at request time) | Override the download server |
| `TP_INSTALL_DIR` | `$HOME/.local/bin` | Where to drop `tp-mcp` |
| `TP_SKIP_SHA` | `0` | Set `1` to skip checksum (debug only, **not recommended**) |

After `install.sh` returns, `tp-mcp --version`-style usage is not the
entry point — `tp-mcp` is an MCP stdio server spawned by your client.
Wire it into `.mcp.json` (see §3) or run `/tp-connect-machine` in
Claude Code to let the skill take it from here.

macOS Gatekeeper: `curl` downloads don't receive the `quarantine`
xattr, so the binary runs without a "malicious software" dialog. If
you *did* fetch it via Safari and the OS refuses to execute it, run
`xattr -d com.apple.quarantine ~/.local/bin/tp-mcp` once.

### 1.2 Contributor path (only if you're modifying tp-mcp itself)

If you need to edit the Rust source rather than just use the tool:

```bash
git clone <your-team-presence-remote> ~/team-presence
export TP_REPO=~/team-presence
cd $TP_REPO
cargo build -p team-presence-tp-mcp        # debug, fast
# for a release build matching what install.sh would serve:
bash scripts/build-release-binaries.sh --native-only
```

Debug build lives at `$TP_REPO/target/debug/tp-mcp`; the release
artifact lands in `$TP_REPO/downloads/tp-mcp-{os}-{arch}` alongside a
regenerated `downloads/manifest.json`. The repo-local `.mcp.json`
points Claude Code at `./target/debug/tp-mcp` by default — so the
curl install and the clone path can coexist on the same laptop
without conflicting. Pick whichever matches what you're doing right
now.

The collector CLI (`team-presence` binary) is still contributor-only
for now; there's no install.sh entry for it yet. Build with
`cargo build -p team-presence-collector` and it lands at
`$TP_REPO/target/debug/team-presence`.

---

## 2. Build the MCP binary (contributor path only)

If you installed via `curl install.sh | sh` (§1.1) you can skip this —
the binary is already at `~/.local/bin/tp-mcp`.

If you followed the contributor path in §1.2 you already have
`$TP_REPO/target/debug/tp-mcp`. Otherwise, from the repo root:

```bash
cargo build -p team-presence-tp-mcp
```

The binary is a stdio JSON-RPC server with no external runtime deps
beyond whatever dynamic libs the system provides (OpenSSL on Linux,
Security framework on macOS — both already on any dev laptop).

---

## 3. Configure yourself as an MCP client

### 3.1 Claude Code

If you installed via §1.1 `install.sh` (the common case), add this to
your user-level `~/.claude/mcp.json` (or copy into a project's
`.mcp.json`). The absolute path works from any CWD:

```json
{
  "mcpServers": {
    "team-presence": {
      "command": "/Users/you/.local/bin/tp-mcp",
      "args": [],
      "env": { "TP_MCP_LOG": "info" }
    }
  }
}
```

If you went the contributor path (§1.2), the repo already ships a
`.mcp.json` at its root using a relative path:

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

See §8 below for the endpoint list, or read
`crates/server/src/lib.rs::build_router` as the authoritative source.

---

## 4. Authenticate

You have two equivalent paths. Pick whichever fits your client.

### 4.1 MCP-driven (preferred — the agent drives end-to-end)

Ask the user these three questions, one at a time, and do **not**
echo the password back in your transcript:

1. "Team-presence server URL?" (default `http://localhost:8080`)
2. "What email do you use for team-presence?"
3. "Password?" (pass to the tool without reading aloud)

Then call:

```jsonc
{"jsonrpc":"2.0","id":20,"method":"tools/call",
 "params":{"name":"tp_collector_login",
  "arguments":{
    "server": "<URL>",
    "email": "<email>",
    "password": "<password>",
    "collector_name": "<optional-friendly-name>"
  }}}
```

On success the tool:
- Calls `/api/v1/auth/login` → access token
- Calls `/api/v1/collectors` → long-lived collector token
- Writes the token to the OS keyring + file fallback (see 4.3)
- Returns `{collector_id, collector_name, email, display_name}`

**Important caveat**: tp-mcp reads credentials **at process start**.
After the tool succeeds, the MCP client must restart tp-mcp for
write tools to become usable. Tell the user to restart their Claude
Code / Codex / Cursor session and come back.

### 4.2 Shell-driven (if you prefer the CLI)

```bash
cd $TP_REPO
cargo run --bin team-presence -- login \
    --server http://localhost:8080 \
    --email <your-team-email>
# interactive password prompt follows
```

This is exactly what `tp_collector_login` wraps — same endpoints, same
credentials file.

### 4.3 Where credentials go

`tp_collector_login` writes to a **0600 file** inside a 0700 directory
(same threat model as `~/.ssh/id_rsa`):

- macOS: `~/Library/Application Support/io.team-presence.team-presence/credentials.json`
- Linux (XDG): `~/.config/team-presence/credentials.json`
- Windows: `%APPDATA%\io.team-presence\team-presence\credentials.json`

Run `team-presence status` and read the `fallback:` line for the exact
path on the current machine.

**Why not the OS keyring?** The collector CLI used to default to
macOS Keychain / libsecret / Windows Credential Manager for the
primary store. That path triggers an "Allow tp-mcp to use your
keychain" dialog every time an unsigned debug binary is spawned — and
MCP clients spawn tp-mcp freely. The file path is identical in
secrecy (0600, user-only) but never shows a popup. If a user already
logged in via `team-presence login` and their creds are in the
keyring, tp-mcp still falls back to reading the keyring when the file
is absent — so existing users aren't broken.

### 4.4 Pure-headless fallback (no human, no keyring)

If you are running in a CI-like context without a human to answer
questions and without writeable keyring/config, call the HTTP API
directly and hold the JWT in memory:

```http
POST http://localhost:8080/api/v1/auth/login
Content-Type: application/json

{"email": "<email>", "password": "<password>"}
```

Response: `{ access_token, access_ttl_secs, user }`. Use that token
for every subsequent HTTP request. Refresh before the 15-minute TTL
expires (`POST /api/v1/auth/refresh` with the refresh cookie). This
bypasses tp-mcp entirely — you would not use the MCP tools.

---

## 5. Wire your Claude Code session into the live stream

§4 authenticates you against the HTTP API / MCP; this section wires the
**current Claude Code session on your laptop** into the team-presence
Stream page so teammates (and AI observers watching `/stream`) can see
what you're working on. Two moving parts:

1. **Claude Code hooks** — `SessionStart` + `Stop` scripts in
   `~/.claude/hooks/` that forward metadata to a Unix socket.
2. **Collector daemon** — a long-running `team-presence start` process
   that tails your transcript file and streams frames to the server
   over WebSocket.

You can drive this entirely through the `/tp-connect-machine` skill
(see §7), which wraps the following MCP tools + shell commands. Each
step has its equivalent MCP call and equivalent shell call; pick whichever
fits your client.

### 5.1 Status check

```jsonc
// MCP
{"jsonrpc":"2.0","id":10,"method":"tools/call",
 "params":{"name":"tp_collector_status","arguments":{}}}
```

or shell:

```bash
cd $TP_REPO
cargo run --bin team-presence -- status
```

Expected output when ready: `status=logged_in`, `muted=false`,
credentials pointing at the right server.

### 5.2 Install Claude Code hooks

```jsonc
// MCP
{"jsonrpc":"2.0","id":11,"method":"tools/call",
 "params":{"name":"tp_collector_install_hooks","arguments":{"force":false}}}
```

or shell:

```bash
cd $TP_REPO
cargo run --bin team-presence -- install-hooks
```

This drops two scripts into `~/.claude/hooks/`:

- `team-presence-session-start.sh` — fires when Claude Code opens a
  new session; forwards `{session_id, transcript_path, cwd}` to
  `/tmp/team-presence-<uid>.sock`.
- `team-presence-stop.sh` — fires at the end of each assistant turn;
  forwards the session id + stop metadata so the collector knows the
  session is alive.

The hook scripts are registered in `~/.claude/settings.json` under
`SessionStart` and `Stop`. The installer is idempotent; pass
`force=true` / `--force` only if you need to overwrite hand-edited
scripts.

### 5.3 Launch the collector daemon

The collector binary is the same crate as the `login` / `install-hooks`
subcommands. Run it in a **persistent** shell (or under `nohup` /
`launchd` / `systemd --user`):

```bash
cd $TP_REPO
cargo run --bin team-presence -- start --agent opencode
```

Stays running, tails transcripts, streams frames over WebSocket. Logs
to stderr. You should see:

```
INFO listening for hook events  server=http://localhost:8080
INFO connecting                 url=ws://localhost:8080/ws/collector
INFO collector connected        collector_token_id=<uuid>
```

The `team-presence start --agent opencode` process must stay alive for the whole
session. Closing that shell = stream goes dark.

### 5.4 Verify

Open `http://localhost:5173/stream` in a browser. Within ~10 seconds
of starting a new Claude Code session (or issuing a prompt in the
current session so the `Stop` hook fires), you should see a live
terminal tile for that session.

No terminal appearing? Re-run the status check in §5.1 and double-
check:

- `ls ~/.claude/hooks/team-presence-*.sh` — hooks exist
- `ls /tmp/team-presence-$UID.sock` — collector socket exists
- Tail the `team-presence start` stderr for `collector connected`
- Run `tp_collector_doctor` and follow `fix=` lines when
  `doctor_status=degraded` (especially `opencode_db_state`).

### 5.5 Session control

When you need to silence content frames without killing the daemon (e.g.
handling a private chat):

```jsonc
{"jsonrpc":"2.0","id":12,"method":"tools/call",
 "params":{"name":"tp_collector_mute","arguments":{}}}
// then
{"jsonrpc":"2.0","id":13,"method":"tools/call",
 "params":{"name":"tp_collector_unmute","arguments":{}}}
```

Mute suppresses `session_content` frames but keeps heartbeats +
metadata flowing, so teammates still see that you're online; they
just don't see what you're typing.

To fully disconnect a laptop:

```bash
# Stop the daemon (Ctrl-C the `team-presence start` shell, or:)
pkill -f 'team-presence start'

# Remove the hooks (MCP tool or shell):
cargo run --bin team-presence -- uninstall-hooks
```

Credentials persist in the keyring until you run `team-presence logout`
(separate command).

---

## 6. Verify the MCP connection

After your MCP client loads, issue a `tools/list`; you should see 30
tools (see §8). Then run the smoke tool:

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

## 7. Use the skills

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

All of them are just orchestration over the MCP tools in §8. Nothing in
a skill is required to use team-presence — they are guidance, not gates.

---

## 8. Canonical tool surface (31+ tools)

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
| `tp_collector_login(server, email, password, collector_name?)` | Log in, mint collector token, persist credentials. MCP client must restart tp-mcp after this for write tools to come online. |
| `tp_collector_status()` | Login / mute / socket state + OpenCode diagnostics (`agent_mode`, db state, last event). |
| `tp_collector_doctor()` | OpenCode-oriented local diagnostics with actionable `fix=` hints. |
| `tp_collector_install_hooks(force?)` | Drop Claude Code hook scripts into `~/.claude/hooks/`. |
| `tp_collector_uninstall_hooks()` | Reverse of install. |
| `tp_collector_mute()` | Stop streaming session_content frames. |
| `tp_collector_unmute()` | Resume. |

### Identity

| Tool | Semantics |
|---|---|
| `tp_whoami()` | Returns authenticated user email + UUID + display name. |

---

## 9. Invariants to respect

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

## 10. Minimum viable "hello world"

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

## 11. Further reading

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
