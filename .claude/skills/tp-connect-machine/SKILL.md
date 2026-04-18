---
name: tp-connect-machine
description: Wire a new laptop into team-presence — login, install Claude Code hooks, start the collector, verify it shows up in Stream. Use on first-run, on a teammate's "how do I connect" question, or when the user says "/connect", "接入我的电脑", or "connect my machine".
---

# tp-connect-machine

Step-by-step onboarding. Keep each step to a single action so the user
can follow along.

## 1. Check current state

Run `tp_collector_status`. Based on the result:

- **`status=logged_in` + mute=false** — user is already connected; skip
  to step 4 (verify in Stream).
- **`status=logged_out`** — proceed to step 2.
- **error** — surface the reason, most likely keyring permission issues
  on macOS; suggest the file fallback at
  `~/.config/team-presence/credentials.json`.

## 2. Login

Ask the user for:
- server URL (default `http://localhost:8080` for local dev)
- email

Then instruct them to run in their terminal (you can't elicit the
password through MCP today; this stays manual):

```bash
cargo run --bin team-presence -- login \
    --server <URL> \
    --email <EMAIL>
```

Wait until they confirm "done" / pass a green message.

## 3. Install hooks + start collector

Run `tp_collector_install_hooks` with `force=false`. Show the
installed files.

Then prompt them to run in another terminal:

```bash
cargo run --bin team-presence -- start
```

Tell them to leave that window open — it tails Claude Code sessions.

## 4. Verify in Stream

Ask them to open `http://localhost:5173/stream`. They should see at
least one live terminal (their current Claude Code session) within ~10
seconds.

If nothing shows up after 30s, run diagnostics:
- `tp_collector_status` — still logged in?
- Check stderr on the `team-presence start` window.
- Check `~/.claude/hooks/` contains `team-presence-session-start.sh` +
  `team-presence-stop.sh`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "keyring locked" on macOS | Unlock Keychain or use the file fallback |
| `team-presence login` hangs | Server URL wrong — check /health |
| No session in Stream | Hooks not installed or collector not running |
| "invalid credentials" | Server JWT secret changed — re-login |

## Guardrails

- Don't run `tp_collector_uninstall_hooks` without explicit confirmation
  ("yes, remove hooks"). Accidentally uninstalling breaks the team.
- Don't `tp_collector_mute` as part of the setup flow — that silences
  content frames and confuses the "is it working?" test.
