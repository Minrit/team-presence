---
name: tp-connect-machine
description: Wire a new laptop into team-presence — collect user's email + password, log in via MCP, install Claude Code hooks, start the collector daemon (OpenCode mode), verify the session shows up in Stream. Use on first-run, when a teammate asks "how do I connect", or when the user says "/connect", "接入我的电脑", "connect my machine". Drives tp_collector_login → tp_collector_install_hooks → (human runs `team-presence start --agent opencode`) → tp_collector_status/tp_collector_doctor.
---

# tp-connect-machine

Step-by-step onboarding for a fresh laptop. Each step either calls an
MCP tool (preferred) or asks the user to run one shell command.

## 0. Pre-flight

Run `tp_collector_status`. Branch:

- **`status=logged_in`** — skip to step 3. Credentials already saved.
- **`status=logged_out`** — proceed to step 1 (login).
- **error** — surface the reason; most often the binary isn't built.
  Ask the user to run `cargo build -p team-presence-tp-mcp` in the
  repo root and restart their MCP client.

## 1. Collect identity

**Ask the user two questions, one at a time**:

1. "What's your team-presence server URL?" (default: `http://localhost:8080` for local dev)
2. "What's your email for team-presence?" (if they don't know, try the
    one they'd use for git: `git config user.email`)
3. "What's the password? (Claude will pass this through to the login
    tool — don't paste it anywhere else in the chat.)"

Do **not** echo the password back in the transcript. When you call the
tool, avoid quoting the password value in your own narration.

Optional fourth question:

4. "Any friendly name for this laptop? (default: current hostname)"

## 2. Login

Call `tp_collector_login` with `{server, email, password, collector_name?}`.

On success the tool returns:

```
logged in as <Display Name> <email>
collector_name=<hostname-or-chosen>
collector_id=<uuid>
credentials saved — restart your MCP client so tp-mcp picks them up.
```

**Important:** tp-mcp reads credentials at process start. For the
write tools to become usable, the MCP client (Claude Code, Codex, …)
needs to restart tp-mcp. Two options:

- Ask the user to restart the MCP client.
- Or proceed with step 3 (install-hooks, which doesn't require tp-mcp
  to have credentials — it runs in the collector crate directly), then
  restart when the user is ready.

If the login fails with 401 → wrong email/password. Ask again.
If it fails with a connection error → server unreachable; fix the URL.

## 3. Install Claude Code hooks

Call `tp_collector_install_hooks` with `force: false` (default).

Expected: `installed=[...session-start.sh, ...stop.sh]`. If you see
`skipped=[...]` both files, hooks are already present from an earlier
run — that's fine, no action needed.

## 4. Launch the collector daemon (OpenCode)

The collector is a long-running process that tails Claude Code
transcripts and streams frames to the server. MCP cannot keep a
process alive across calls, so **ask the user to run one shell
command in a persistent terminal**:

```bash
cd $TP_REPO   # or the absolute path to the team-presence repo
cargo run --bin team-presence -- start --agent opencode
```

They should see in stderr:

```
INFO listening for hook events
INFO collector connected
```

Wait for the user to confirm "daemon running" / "I see 'collector
connected'" before continuing.

## 5. Verify

Ask the user to open `http://localhost:5173/stream` (or the appropriate
team-presence web host). Within ~10 seconds of them using their Claude
Code session (the `Stop` hook fires on each assistant turn) they should
see their terminal tile appear.

If nothing appears after 30 seconds:
- `tp_collector_status` — confirm still logged in + not muted + `agent_mode=opencode`.
- `tp_collector_doctor` — confirm `opencode_db_state=readable` and check `fix=` guidance when degraded.
- Check the `team-presence start` stderr for errors.
- `ls ~/.claude/hooks/team-presence-*.sh` — confirm hooks are present.
- Tell them to restart their Claude Code client — existing sessions
  don't re-fire `SessionStart` hooks.

## 6. Wrap-up

Congratulate the user. Tell them:

- `/tp-dev-story` is the main workflow skill — use it to work a story
  end-to-end.
- `tp_collector_mute` / `tp_collector_unmute` when they want a private
  session.
- The board at `http://localhost:5173` is **read-only** — all writes
  flow through MCP tools; they don't need to learn "click X to do Y".

## Guardrails

- Never invent an email or password. If the user won't provide them,
  stop and ask again.
- Never call `tp_collector_login` without explicit user confirmation
  that they want their credentials saved on this machine.
- Never call `tp_collector_uninstall_hooks` during onboarding — that's
  the cleanup flow, not setup.
- Never start the collector daemon yourself via `Bash` — it needs to
  outlive your agent turn. Always hand off to the user's terminal.
