# team-presence agent setup

This server hosts team-presence MCP at `/mcp`. Do not start a local `tp-mcp`
stdio process for normal use.

## 1. Install the local collector CLI

```bash
curl -fsSL https://<team-presence-server>/install.sh | sh
```

Replace `https://<team-presence-server>` with the actual team-presence server
URL.

The installer downloads `team-presence-{os}-{arch}` from
`/download/manifest.json`, verifies sha256, and installs
`~/.local/bin/team-presence` unless `TP_INSTALL_DIR` is set.

Supported artifacts:

| OS | CPU | Artifact |
|---|---|---|
| macOS | Apple Silicon | `team-presence-darwin-aarch64` |
| macOS | Intel | `team-presence-darwin-x86_64` |
| Linux | arm64 | `team-presence-linux-aarch64` |
| Linux | x86_64 | `team-presence-linux-x86_64` |

## 2. Log in

```bash
team-presence login --server https://<team-presence-server> --email <you>
```

This stores a collector token in the OS keyring with a 0600 file fallback.

## 3. Configure your MCP client

```bash
team-presence mcp-config
```

Use the printed:

- `remote_mcp_endpoint`, for example `https://<server>/mcp`
- `authorization_header`, for example `Bearer tp_...`

The command also prints a generic JSON shape for clients that support remote
MCP configuration:

```json
{
  "mcpServers": {
    "team-presence": {
      "url": "https://<server>/mcp",
      "headers": {
        "Authorization": "Bearer tp_..."
      }
    }
  }
}
```

Client config formats differ. Keep the endpoint and Authorization header, but
adapt the surrounding JSON to your client.

## 4. Start local capture

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

## 5. Expected MCP tools

`tools/list` on `/mcp` should show PM tools:

- `tp_whoami`
- `tp_story_list`, `tp_story_get`, `tp_story_create`, `tp_story_edit`,
  `tp_story_move_status`, `tp_story_claim`, `tp_story_delete`
- `tp_ac_add`, `tp_ac_check`, `tp_ac_uncheck`, `tp_ac_edit`, `tp_ac_remove`
- `tp_comment_create`, `tp_comment_list`
- `tp_relation_block`, `tp_relation_unblock`, `tp_relation_list`
- `tp_activity_list`
- `tp_sprint_list`, `tp_sprint_create`, `tp_sprint_edit`
- `tp_epic_list`, `tp_epic_create`, `tp_epic_edit`

Collector-local commands are deliberately not MCP tools. Run them with the
`team-presence` CLI instead.

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| MCP returns 401 | Run `team-presence login`, then refresh your MCP config with `team-presence mcp-config`. |
| Client still tries to spawn `tp-mcp` | Remove old stdio MCP config and point the client at `https://<server>/mcp`. |
| Stream page is empty | Start the collector and check `team-presence doctor`. |
| Downloaded binary blocked on macOS | Run `xattr -d com.apple.quarantine ~/.local/bin/team-presence`. |
