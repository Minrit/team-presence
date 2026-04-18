//! Capture pipeline: hook socket → transcript tail → shared-types `Frame`s.
//!
//! Phase B (this module) produces frames. Phase C (ws_client) will consume
//! from the same `mpsc::Receiver` and push them over a WebSocket. A dev-time
//! consumer that prints to stdout is wired into `start::run_offline` so the
//! capture path can be exercised without Unit 7.

pub mod hook_socket;
pub mod transcript;

use serde::Deserialize;
use std::path::PathBuf;
use uuid::Uuid;

/// Payload the hook shell scripts pipe into the local unix socket.
/// Kind discriminates lifecycle events; the nested `payload` is whatever
/// Claude Code handed to stdin, verbatim, so we stay tolerant to version drift.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum HookEvent {
    SessionStart { payload: HookSessionStartPayload },
    Stop { payload: HookStopPayload },
}

#[derive(Debug, Clone, Deserialize)]
pub struct HookSessionStartPayload {
    pub session_id: Option<String>,
    pub transcript_path: Option<PathBuf>,
    pub cwd: Option<String>,
    /// Caught-and-skipped unknown fields land here; keeps us forward-compat.
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct HookStopPayload {
    pub session_id: Option<String>,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

impl HookEvent {
    /// Parse a raw socket line. Returns None when the line isn't a JSON object
    /// we recognize — log-and-skip is the plan's forward-compat policy.
    pub fn try_parse(line: &str) -> Option<Self> {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return None;
        }
        serde_json::from_str::<Self>(trimmed).ok()
    }
}

/// Best-effort session_id parse. Hooks pass it as a string in Claude Code's
/// current schema; if it's missing or malformed we fabricate a UUID so frames
/// still thread together on the server side.
pub fn session_uuid(raw: Option<&str>) -> Uuid {
    raw.and_then(|s| Uuid::parse_str(s).ok())
        .unwrap_or_else(Uuid::new_v4)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_session_start_with_all_fields() {
        let raw = r#"{"kind":"session_start","payload":{"session_id":"11111111-1111-1111-1111-111111111111","transcript_path":"/tmp/t.jsonl","cwd":"/repo"}}"#;
        let evt = HookEvent::try_parse(raw).unwrap();
        match evt {
            HookEvent::SessionStart { payload } => {
                assert_eq!(
                    payload.session_id.as_deref(),
                    Some("11111111-1111-1111-1111-111111111111")
                );
                assert_eq!(
                    payload.transcript_path.as_deref(),
                    Some(std::path::Path::new("/tmp/t.jsonl"))
                );
                assert_eq!(payload.cwd.as_deref(), Some("/repo"));
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn tolerates_unknown_top_level_fields() {
        // Claude Code version drift — extra metadata fields should be ignored.
        let raw = r#"{"kind":"session_start","payload":{"session_id":"x","future_field":"future_value"}}"#;
        let evt = HookEvent::try_parse(raw).unwrap();
        if let HookEvent::SessionStart { payload } = evt {
            assert!(payload.extra.contains_key("future_field"));
        } else {
            panic!("wrong variant");
        }
    }

    #[test]
    fn stop_event_minimal() {
        let raw = r#"{"kind":"stop","payload":{"session_id":"abc"}}"#;
        let evt = HookEvent::try_parse(raw).unwrap();
        assert!(matches!(evt, HookEvent::Stop { .. }));
    }

    #[test]
    fn malformed_line_returns_none() {
        assert!(HookEvent::try_parse("not json").is_none());
        assert!(HookEvent::try_parse("").is_none());
        assert!(HookEvent::try_parse(r#"{"kind":"unknown_kind"}"#).is_none());
    }

    #[test]
    fn session_uuid_fabricates_when_missing() {
        let a = session_uuid(None);
        let b = session_uuid(None);
        assert_ne!(a, b, "should generate fresh UUIDs when none provided");
    }

    #[test]
    fn session_uuid_parses_valid_input() {
        let id = "22222222-2222-2222-2222-222222222222";
        assert_eq!(session_uuid(Some(id)).to_string(), id);
    }
}
