use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "TEXT", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum StoryStatus {
    Todo,
    Doing,
    Done,
}

impl StoryStatus {
    /// MVP is permissive: any transition is allowed. Shape is here so Phase 2 can
    /// tighten without touching call sites.
    pub fn can_transition_to(self, _other: StoryStatus) -> bool {
        true
    }
}

impl std::str::FromStr for StoryStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "todo" => Ok(Self::Todo),
            "doing" => Ok(Self::Doing),
            "done" => Ok(Self::Done),
            other => Err(format!("unknown story status: {other}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Story {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub acceptance_criteria: String,
    pub status: StoryStatus,
    pub owner_id: Option<Uuid>,
    pub repo: Option<String>,
    pub sprint_id: Option<Uuid>,
    pub last_modified_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStoryRequest {
    /// `name` is canonical; `title` accepted as alias so existing clients
    /// (e.g. bmad importer, early tests) keep working.
    #[serde(default, alias = "title")]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub acceptance_criteria: Option<String>,
    #[serde(default)]
    pub status: Option<StoryStatus>,
    #[serde(default)]
    pub owner_id: Option<Uuid>,
    #[serde(default)]
    pub repo: Option<String>,
    #[serde(default)]
    pub sprint_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct PatchStoryRequest {
    #[serde(default, alias = "title")]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub acceptance_criteria: Option<String>,
    #[serde(default)]
    pub status: Option<StoryStatus>,
    /// Tri-state: `Some(Some(uuid))` → set, `Some(None)` → unset, `None` → unchanged.
    #[serde(default, deserialize_with = "crate::stories::model::de_opt_opt")]
    pub owner_id: Option<Option<Uuid>>,
    #[serde(default, deserialize_with = "crate::stories::model::de_opt_opt")]
    pub repo: Option<Option<String>>,
    #[serde(default, deserialize_with = "crate::stories::model::de_opt_opt")]
    pub sprint_id: Option<Option<Uuid>>,
}

#[derive(Debug, Deserialize, Default)]
pub struct ListStoriesQuery {
    #[serde(default)]
    pub status: Option<StoryStatus>,
    #[serde(default)]
    pub owner: Option<Uuid>,
    #[serde(default)]
    pub sprint: Option<Uuid>,
}

/// Deserialize an explicit `null` as `Some(None)` and absence as `None`.
/// Lets PATCH callers distinguish "unset field" from "leave field alone".
pub(crate) fn de_opt_opt<'de, T, D>(de: D) -> Result<Option<Option<T>>, D::Error>
where
    T: serde::Deserialize<'de>,
    D: serde::Deserializer<'de>,
{
    Option::<T>::deserialize(de).map(Some)
}
