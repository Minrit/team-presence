use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Task {
    pub id: Uuid,
    pub story_id: Uuid,
    pub title: String,
    pub done_at: Option<DateTime<Utc>>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    #[serde(default)]
    pub position: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct PatchTaskRequest {
    #[serde(default)]
    pub title: Option<String>,
    /// `Some(true)` → mark done now; `Some(false)` → clear done_at. Absent → no change.
    #[serde(default)]
    pub done: Option<bool>,
    #[serde(default)]
    pub position: Option<i32>,
}
