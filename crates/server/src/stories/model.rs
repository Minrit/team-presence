use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

/// 5-state workflow from the Hive design system.
/// Rust FSM stays permissive so transitions can be tightened in Phase 2
/// without chasing call sites.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum StoryStatus {
    Todo,
    InProgress,
    Blocked,
    Review,
    Done,
}

impl StoryStatus {
    pub fn can_transition_to(self, _other: StoryStatus) -> bool {
        true
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Todo => "todo",
            Self::InProgress => "in_progress",
            Self::Blocked => "blocked",
            Self::Review => "review",
            Self::Done => "done",
        }
    }
}

impl std::str::FromStr for StoryStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "todo" => Ok(Self::Todo),
            "in_progress" => Ok(Self::InProgress),
            "blocked" => Ok(Self::Blocked),
            "review" => Ok(Self::Review),
            "done" => Ok(Self::Done),
            other => Err(format!("unknown story status: {other}")),
        }
    }
}

/// P1-P4. Nullable at the DB layer; the frontend renders no glyph when absent.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
pub enum Priority {
    #[serde(rename = "P1")]
    P1,
    #[serde(rename = "P2")]
    P2,
    #[serde(rename = "P3")]
    P3,
    #[serde(rename = "P4")]
    P4,
}

impl std::str::FromStr for Priority {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "P1" => Ok(Self::P1),
            "P2" => Ok(Self::P2),
            "P3" => Ok(Self::P3),
            "P4" => Ok(Self::P4),
            other => Err(format!("unknown priority: {other}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Story {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    /// JSONB array of `{text: string, done: bool}`. Kept as raw JSON so callers
    /// (frontend + bmad importer) can treat it as opaque.
    pub acceptance_criteria: JsonValue,
    pub status: StoryStatus,
    pub owner_id: Option<Uuid>,
    pub repo: Option<String>,
    pub sprint_id: Option<Uuid>,
    pub priority: Option<Priority>,
    pub points: Option<i32>,
    pub epic_id: Option<Uuid>,
    pub branch: Option<String>,
    pub pr_ref: Option<String>,
    pub last_modified_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStoryRequest {
    #[serde(default, alias = "title")]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    /// Accept either a JSON array (new shape) or a string (legacy bmad).
    #[serde(default)]
    pub acceptance_criteria: Option<JsonValue>,
    #[serde(default)]
    pub status: Option<StoryStatus>,
    #[serde(default)]
    pub owner_id: Option<Uuid>,
    #[serde(default)]
    pub repo: Option<String>,
    #[serde(default)]
    pub sprint_id: Option<Uuid>,
    #[serde(default)]
    pub priority: Option<Priority>,
    #[serde(default)]
    pub points: Option<i32>,
    #[serde(default)]
    pub epic_id: Option<Uuid>,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub pr_ref: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PatchStoryRequest {
    #[serde(default, alias = "title")]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub acceptance_criteria: Option<JsonValue>,
    #[serde(default)]
    pub status: Option<StoryStatus>,
    /// Tri-state: `Some(Some(uuid))` → set, `Some(None)` → unset, `None` → unchanged.
    #[serde(default, deserialize_with = "de_opt_opt")]
    pub owner_id: Option<Option<Uuid>>,
    #[serde(default, deserialize_with = "de_opt_opt")]
    pub repo: Option<Option<String>>,
    #[serde(default, deserialize_with = "de_opt_opt")]
    pub sprint_id: Option<Option<Uuid>>,
    #[serde(default, deserialize_with = "de_opt_opt")]
    pub priority: Option<Option<Priority>>,
    #[serde(default, deserialize_with = "de_opt_opt")]
    pub points: Option<Option<i32>>,
    #[serde(default, deserialize_with = "de_opt_opt")]
    pub epic_id: Option<Option<Uuid>>,
    #[serde(default, deserialize_with = "de_opt_opt")]
    pub branch: Option<Option<String>>,
    #[serde(default, deserialize_with = "de_opt_opt")]
    pub pr_ref: Option<Option<String>>,
}

#[derive(Debug, Deserialize, Default)]
pub struct ListStoriesQuery {
    #[serde(default)]
    pub status: Option<StoryStatus>,
    #[serde(default)]
    pub owner: Option<Uuid>,
    #[serde(default)]
    pub sprint: Option<Uuid>,
    #[serde(default)]
    pub epic: Option<Uuid>,
    #[serde(default)]
    pub priority: Option<Priority>,
}

/// Deserialize an explicit `null` as `Some(None)` and absence as `None`.
pub(crate) fn de_opt_opt<'de, T, D>(de: D) -> Result<Option<Option<T>>, D::Error>
where
    T: serde::Deserialize<'de>,
    D: serde::Deserializer<'de>,
{
    Option::<T>::deserialize(de).map(Some)
}

// --- Activity log -----------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "TEXT", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ActivityActor {
    User,
    Agent,
    System,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct StoryActivity {
    pub id: Uuid,
    pub story_id: Uuid,
    pub actor_type: ActivityActor,
    pub actor_ref: String,
    pub kind: String,
    pub text: String,
    pub r#ref: Option<String>,
    pub created_at: DateTime<Utc>,
}

// --- Relations --------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "TEXT", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum RelationKind {
    Blocks,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct StoryRelation {
    pub from_story_id: Uuid,
    pub to_story_id: Uuid,
    pub kind: RelationKind,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRelationRequest {
    pub kind: RelationKind,
    pub to: Uuid,
}

#[derive(Debug, Deserialize, Default)]
pub struct ListActivityQuery {
    #[serde(default)]
    pub limit: Option<i64>,
}
