---
name: tp-connect-machine
description: Wire a laptop or agent into hosted team-presence. Use on first-run, when MCP returns 401/unauthorized, when a teammate asks "how do I connect", or when the user says "/connect", "接入我的电脑", "connect my machine". Guides install.sh -> team-presence login -> team-presence mcp-config -> remote /mcp client config -> optional local collector start.
---

# tp-connect-machine

Use this when the user or agent cannot use team-presence MCP yet, especially
when direct access to `/mcp` returns 401/unauthorized.

Important: `/mcp` is protected by Bearer auth. A 401 from a browser or an MCP
client is expected until the client is configured with a token. The login flow
happens through the local `team-presence` CLI, not through an MCP tool.

## 0. Identify the Server

Ask for the team-presence server URL if it is not obvious.

Default examples:

- Production: `https://rancher.zstack.io`
- Local dev: `http://localhost:8080`

Tell the user that the canonical raw guide is:

```bash
curl -fsSL <server>/agent-setup.md
```

## 1. Install the Local Collector CLI

Ask the user to run:

```bash
curl -fsSL <server>/install.sh | sh
```

If `~/.local/bin` is not on PATH, ask them to add:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Verify:

```bash
team-presence --help
```

Expected: the command list includes `login`, `mcp-config`, `status`,
`doctor`, `install-hooks`, and `start`.

## 2. Login

Ask for the email. Ask for the password only when the user is ready to run the
login command. Do not echo the password back.

```bash
team-presence login --server <server> --email <you>
```

If login fails with 401, the email or password is wrong. Ask again.

If login succeeds, credentials are saved locally in the OS keyring with a 0600
file fallback.

## 3. Configure Remote MCP

Ask the user to run:

```bash
team-presence mcp-config
```

It prints:

- `remote_mcp_endpoint`, for example `<server>/mcp`
- `authorization_header`, for example `Bearer tp_...`
- a generic JSON config shape

Tell the user to configure their MCP client with the remote endpoint and the
Authorization header. Do not configure a local `tp-mcp` stdio command for
normal use.

Generic shape:

```json
{
  "mcpServers": {
    "team-presence": {
      "url": "<server>/mcp",
      "headers": {
        "Authorization": "Bearer tp_..."
      }
    }
  }
}
```

Client config formats differ. Keep the URL and Authorization header, but adapt
the surrounding JSON to the client.

After changing MCP config, reload or restart the MCP client so it reconnects.

## 4. Verify MCP

After the client reloads, run `tools/list`.

Expected PM tools include:

- `tp_whoami`
- `tp_story_list`, `tp_story_get`, `tp_story_create`, `tp_story_edit`
- `tp_ac_add`, `tp_ac_check`, `tp_ac_uncheck`, `tp_ac_edit`, `tp_ac_remove`
- `tp_comment_create`, `tp_comment_list`
- `tp_relation_block`, `tp_relation_unblock`, `tp_relation_list`
- `tp_activity_list`
- `tp_sprint_list`, `tp_sprint_create`, `tp_sprint_edit`
- `tp_epic_list`, `tp_epic_create`, `tp_epic_edit`

Collector-local commands should not appear as MCP tools. Run them through the
CLI instead.

## 5. Start Local Capture

OpenCode:

```bash
team-presence start --agent opencode
```

Claude Code hooks:

```bash
team-presence install-hooks
team-presence start --agent claude_code
```

Diagnostics:

```bash
team-presence status
team-presence doctor
```

## Failure Modes

- Browser opens `/mcp` and sees unauthorized: expected. Configure an MCP client
  with the Bearer header from `team-presence mcp-config`.
- MCP client gets 401: re-run `team-presence login`, then update the client
  Authorization header from `team-presence mcp-config`.
- Client still tries to spawn `tp-mcp`: remove old stdio config and configure
  the hosted `<server>/mcp` endpoint.
- `team-presence` command not found: add `~/.local/bin` to PATH or rerun
  install with `TP_INSTALL_DIR` set to a PATH directory.
- Stream page is empty: start the collector and run `team-presence doctor`.

## Guardrails

- Never invent an email or password.
- Never paste the user's password back into chat.
- Never ask the user to configure local `tp-mcp` for normal use.
- Never expose the Bearer token in screenshots or shared chat unless the user
  explicitly understands it is a secret.
