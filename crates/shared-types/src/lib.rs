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

/// Which agent runtime emitted the session. Hive design (Unit 14) renders an
/// AgentChip per value; only `ClaudeCode` currently has a real capture path
/// (MVP), the others are reserved for collector work in a later plan.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AgentKind {
    ClaudeCode,
    Cursor,
    Codex,
    Aider,
    Local,
}

impl AgentKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ClaudeCode => "claude_code",
            Self::Cursor => "cursor",
            Self::Codex => "codex",
            Self::Aider => "aider",
            Self::Local => "local",
        }
    }
}

impl std::str::FromStr for AgentKind {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "claude_code" => Ok(Self::ClaudeCode),
            "cursor" => Ok(Self::Cursor),
            "codex" => Ok(Self::Codex),
            "aider" => Ok(Self::Aider),
            "local" => Ok(Self::Local),
            other => Err(format!("unknown agent_kind: {other}")),
        }
    }
}

/// Backwards-compat alias — keeps pre-Unit-12 collector builds compiling.
/// Remove after one release cycle once all dependents migrate to `AgentKind`.
pub type CliKind = AgentKind;

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
        /// Historically `cli`; keep the wire name for v1 collectors and add
        /// `agent_kind` as a deserialize alias so new-shape payloads work too.
        #[serde(alias = "agent_kind")]
        cli: AgentKind,
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
    use std::str::FromStr;

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

    #[test]
    fn agent_kind_all_variants_round_trip() {
        for kind in [
            AgentKind::ClaudeCode,
            AgentKind::Cursor,
            AgentKind::Codex,
            AgentKind::Aider,
            AgentKind::Local,
        ] {
            let s = serde_json::to_string(&kind).unwrap();
            assert_eq!(s, format!("\"{}\"", kind.as_str()));
            let back: AgentKind = serde_json::from_str(&s).unwrap();
            assert_eq!(back, kind);
            assert_eq!(AgentKind::from_str(kind.as_str()).unwrap(), kind);
        }
    }

    #[test]
    fn session_start_accepts_agent_kind_alias() {
        let json = r#"{
            "type":"session_start",
            "session_id":"00000000-0000-0000-0000-000000000000",
            "agent_kind":"cursor",
            "cwd":"/tmp",
            "started_at":"2026-04-18T00:00:00Z"
        }"#;
        let f: Frame = serde_json::from_str(json).unwrap();
        assert!(matches!(f, Frame::SessionStart { cli: AgentKind::Cursor, .. }));
    }

    #[test]
    fn cli_kind_alias_still_compiles() {
        // If this ever fails the #[allow(dead_code)] alias is missing.
        let _k: CliKind = CliKind::ClaudeCode;
    }
}
