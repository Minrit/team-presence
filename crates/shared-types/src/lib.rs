use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Opaque wrapper for user-facing payload text.
/// Debug prints only byte length so `tracing::debug!(?frame)` cannot leak content
/// (per the plan's security posture: MVP ships without redaction, so accidentally
/// logging content is the top-risk pitfall).
#[derive(Clone, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Content(pub String);

impl std::fmt::Debug for Content {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "<content:{} bytes>", self.0.len())
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CliKind {
    ClaudeCode,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ContentRole {
    User,
    Assistant,
    ToolUse,
    ToolResult,
    Meta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Frame {
    SessionStart {
        session_id: Uuid,
        cli: CliKind,
        cwd: String,
        git_remote: Option<String>,
        git_branch: Option<String>,
        transcript_path: Option<String>,
        started_at: DateTime<Utc>,
    },
    SessionContent {
        session_id: Uuid,
        role: ContentRole,
        text: Content,
        ts: DateTime<Utc>,
    },
    SessionEnd {
        session_id: Uuid,
        ended_at: DateTime<Utc>,
        exit_code: Option<i32>,
    },
    Heartbeat {
        sent_at: DateTime<Utc>,
        active_session_ids: Vec<Uuid>,
        muted: bool,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn content_debug_hides_bytes() {
        let c = Content("my api key is sk-abc123".into());
        let dbg = format!("{c:?}");
        assert!(!dbg.contains("sk-abc123"));
        assert!(dbg.contains("bytes"));
    }

    #[test]
    fn heartbeat_frame_round_trips() {
        let f = Frame::Heartbeat {
            sent_at: Utc::now(),
            active_session_ids: vec![],
            muted: false,
        };
        let json = serde_json::to_string(&f).unwrap();
        let back: Frame = serde_json::from_str(&json).unwrap();
        assert!(matches!(back, Frame::Heartbeat { muted: false, .. }));
    }

    #[test]
    fn session_content_frame_round_trips() {
        let f = Frame::SessionContent {
            session_id: Uuid::nil(),
            role: ContentRole::Assistant,
            text: Content("hello".into()),
            ts: Utc::now(),
        };
        let json = serde_json::to_string(&f).unwrap();
        assert!(json.contains("\"type\":\"session_content\""));
        assert!(json.contains("\"role\":\"assistant\""));
        let back: Frame = serde_json::from_str(&json).unwrap();
        assert!(matches!(back, Frame::SessionContent { .. }));
    }
}
