# team-presence

Internal team tool: Kanban + claude-code live-streaming Grid for a 6-person team.

**Status:** Unit 1 scaffold. See implementation plan at
`ai-native-workspace/docs/plans/2026-04-18-006-feat-team-presence-tool-plan.md`.

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
