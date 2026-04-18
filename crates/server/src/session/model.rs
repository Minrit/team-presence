use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct SessionMeta {
    pub id: Uuid,
    pub collector_token_id: Uuid,
    pub user_id: Uuid,
    pub agent_kind: String,
    pub cwd: String,
    pub git_remote: Option<String>,
    pub git_branch: Option<String>,
    pub detected_story_id: Option<Uuid>,
    pub started_at: DateTime<Utc>,
    pub last_heartbeat_at: DateTime<Utc>,
    pub last_activity_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub exit_code: Option<i32>,
}

/// Compact summary shipped to `/sse/grid` viewers — strictly metadata.
#[derive(Debug, Clone, Serialize)]
pub struct GridTile {
    pub session_id: Uuid,
    pub user_id: Uuid,
    pub agent_kind: String,
    pub cwd: String,
    pub detected_story_id: Option<Uuid>,
    pub last_heartbeat_at: DateTime<Utc>,
    pub last_activity_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub muted: bool,
}

impl GridTile {
    /// Build a tile from persisted meta. `muted` defaults false because the DB
    /// has no mute column — mute state is volatile and flows through heartbeats.
    pub fn from_meta(meta: &SessionMeta, muted: bool) -> Self {
        Self {
            session_id: meta.id,
            user_id: meta.user_id,
            agent_kind: meta.agent_kind.clone(),
            cwd: meta.cwd.clone(),
            detected_story_id: meta.detected_story_id,
            last_heartbeat_at: meta.last_heartbeat_at,
            last_activity_at: meta.last_activity_at,
            ended_at: meta.ended_at,
            muted,
        }
    }
}
