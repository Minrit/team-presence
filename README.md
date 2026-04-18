# team-presence

Internal team tool: **read-only board** of teammates' active Claude
Code sessions + stories, driven entirely by an MCP toolchain. The
browser observes; Claude Code (via the seven `/tp-*` skills) does the
work.

**Status:** AI-native refactor complete (plan 009). See
[`docs/ai-native.md`](docs/ai-native.md) for the full usage guide.

## Quick start

Requires Docker Compose + a recent Rust toolchain (only for the collector build).

```bash
docker compose up -d postgres redis server
curl http://localhost:8080/health    # -> ok
```

The collector (installed on each developer's laptop) is built from
`crates/collector` and distributed separately — see Unit 6 in the plan.

## Scope (MVP)

- Minimal story/task Kanban (Todo / Doing / Done).
- Live text streaming Grid of teammates' **claude code** sessions (via
  `~/.claude/projects/<id>/history.jsonl` tail).
- One-shot bmad markdown importer.

**Explicit non-goals:** OpenCode capture (Phase 2), content redaction
(Phase 2), role tiers (everyone admin), multi-workspace, permanent archive.

## Layout

```
crates/
  server/          Axum HTTP + WebSocket + SSE server
  collector/       Single-binary laptop collector
  shared-types/    Wire-format types (shared)
web/               Vite + React frontend
```
