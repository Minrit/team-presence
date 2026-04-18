-- Unit 12: rename sessions_meta.cli → agent_kind and widen the enum set.
--   * Frontend AgentChip (Unit 14) needs to tell claude / cursor / codex /
--     aider / local apart so icons + colors render correctly.
--   * Existing rows all carry 'claude_code' which is valid in the new set —
--     no data migration needed.
--   * Old collector binaries still send CliKind::ClaudeCode over the wire;
--     serde round-trip stays compatible because 'claude_code' is still the
--     canonical value.

ALTER TABLE sessions_meta RENAME COLUMN cli TO agent_kind;
ALTER TABLE sessions_meta DROP CONSTRAINT IF EXISTS sessions_meta_cli_check;
ALTER TABLE sessions_meta
    ADD CONSTRAINT sessions_meta_agent_kind_check
    CHECK (agent_kind IN ('claude_code','cursor','codex','aider','local'));
