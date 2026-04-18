//! Test-only helpers shared across modules.
//!
//! Currently tiny; grows with Phase B/C.

pub fn sample_jsonl_user() -> &'static str {
    r#"{"type":"user","message":{"role":"user","content":"hello"},"uuid":"11111111-1111-1111-1111-111111111111","sessionId":"22222222-2222-2222-2222-222222222222","timestamp":"2026-04-18T10:00:00Z"}"#
}

pub fn sample_jsonl_assistant() -> &'static str {
    r#"{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"hi there"}]},"uuid":"33333333-3333-3333-3333-333333333333","sessionId":"22222222-2222-2222-2222-222222222222","timestamp":"2026-04-18T10:00:01Z"}"#
}
