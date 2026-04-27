-- Extend sessions_meta agent kind allowlist for OpenCode collectors.
-- This keeps DB constraints aligned with shared-types AgentKind::OpenCode.

ALTER TABLE sessions_meta DROP CONSTRAINT IF EXISTS sessions_meta_agent_kind_check;
ALTER TABLE sessions_meta
    ADD CONSTRAINT sessions_meta_agent_kind_check
    CHECK (agent_kind IN ('claude_code','cursor','codex','opencode','aider','local'));
