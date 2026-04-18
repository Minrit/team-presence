use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde_json::{json, Value as JsonValue};
use uuid::Uuid;

use super::activity;
use super::model::{
    ActivityActor, CreateRelationRequest, CreateStoryRequest, ListActivityQuery,
    ListStoriesQuery, PatchStoryRequest, RelationKind, Story, StoryActivity, StoryRelation,
    StoryStatus,
};
use super::repo::{
    self, BRANCH_MAX_BYTES, FIELD_MAX_BYTES, NAME_MAX_BYTES, PR_REF_MAX_BYTES,
};
use crate::{auth::model::Identity, error::AppError, state::AppState};

pub async fn create(
    State(state): State<AppState>,
    Extension(identity): Extension<Identity>,
    Json(req): Json<CreateStoryRequest>,
) -> Result<Json<Story>, AppError> {
    let name = req
        .name
        .as_deref()
        .map(str::trim)
        .ok_or_else(|| AppError::BadRequest("name required".into()))?;
    validate_name(name)?;

    let desc = req.description.unwrap_or_default();
    let ac = normalize_acceptance(req.acceptance_criteria)?;
    validate_body(&desc, "description")?;
    validate_branch(req.branch.as_deref())?;
    validate_pr_ref(req.pr_ref.as_deref())?;

    let status = req.status.unwrap_or(StoryStatus::Todo);
    let story = repo::create(
        &state.db,
        identity.user_id,
        name,
        &desc,
        &ac,
        status,
        req.owner_id,
        req.repo.as_deref(),
        req.sprint_id,
        req.priority,
        req.points,
        req.epic_id,
        req.branch.as_deref(),
        req.pr_ref.as_deref(),
    )
    .await?;

    activity::emit(
        &state.db,
        Some(&state.redis),
        story.id,
        ActivityActor::User,
        &identity.user_id.to_string(),
        activity::CREATE,
        &format!("created story '{}'", story.name),
        None,
    )
    .await;

    Ok(Json(story))
}

pub async fn list(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
    Query(q): Query<ListStoriesQuery>,
) -> Result<Json<Vec<Story>>, AppError> {
    Ok(Json(repo::list(&state.db, &q).await?))
}

pub async fn get_one(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
    Path(id): Path<Uuid>,
) -> Result<Json<Story>, AppError> {
    let story = repo::get(&state.db, id).await?.ok_or(AppError::NotFound)?;
    Ok(Json(story))
}

pub async fn patch(
    State(state): State<AppState>,
    Extension(identity): Extension<Identity>,
    Path(id): Path<Uuid>,
    Json(req): Json<PatchStoryRequest>,
) -> Result<Json<Story>, AppError> {
    if let Some(n) = &req.name {
        validate_name(n.trim())?;
    }
    if let Some(d) = &req.description {
        validate_body(d, "description")?;
    }

    let ac = match req.acceptance_criteria {
        Some(v) => Some(normalize_acceptance(Some(v))?),
        None => None,
    };
    if let Some(Some(b)) = req.branch.as_ref() {
        validate_branch(Some(b))?;
    }
    if let Some(Some(p)) = req.pr_ref.as_ref() {
        validate_pr_ref(Some(p))?;
    }

    let prev = repo::get(&state.db, id).await?.ok_or(AppError::NotFound)?;

    let story = repo::patch(
        &state.db,
        id,
        identity.user_id,
        req.name.as_deref().map(str::trim),
        req.description.as_deref(),
        ac.as_ref(),
        req.status,
        req.owner_id,
        req.repo.as_ref().map(|o| o.as_deref()),
        req.sprint_id,
        req.priority,
        req.points,
        req.epic_id,
        req.branch.as_ref().map(|o| o.as_deref()),
        req.pr_ref.as_ref().map(|o| o.as_deref()),
    )
    .await?
    .ok_or(AppError::NotFound)?;

    if let Some(new_status) = req.status {
        if new_status != prev.status {
            activity::emit(
                &state.db,
                Some(&state.redis),
                story.id,
                ActivityActor::User,
                &identity.user_id.to_string(),
                activity::STATUS_CHANGE,
                &format!(
                    "status changed {} → {}",
                    prev.status.as_str(),
                    new_status.as_str()
                ),
                None,
            )
            .await;
        }
    }

    let is_claim = matches!(req.owner_id, Some(Some(owner)) if Some(owner) == Some(identity.user_id) && prev.owner_id.is_none());
    if is_claim {
        activity::emit(
            &state.db,
            Some(&state.redis),
            story.id,
            ActivityActor::User,
            &identity.user_id.to_string(),
            activity::CLAIM,
            "claimed story",
            None,
        )
        .await;
    } else {
        // Generic edit activity for everything else that changed.
        let non_status_edit = req.name.is_some()
            || req.description.is_some()
            || ac.is_some()
            || req.owner_id.is_some()
            || req.repo.is_some()
            || req.sprint_id.is_some()
            || req.priority.is_some()
            || req.points.is_some()
            || req.epic_id.is_some()
            || req.branch.is_some()
            || req.pr_ref.is_some();
        if non_status_edit {
            activity::emit(
                &state.db,
                Some(&state.redis),
                story.id,
                ActivityActor::User,
                &identity.user_id.to_string(),
                activity::EDIT,
                "edited story",
                None,
            )
            .await;
        }
    }

    Ok(Json(story))
}

pub async fn delete(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    let removed = repo::delete(&state.db, id).await?;
    if !removed {
        return Err(AppError::NotFound);
    }
    Ok(())
}

// --- Activity ---------------------------------------------------------------

pub async fn list_activity(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
    Path(id): Path<Uuid>,
    Query(q): Query<ListActivityQuery>,
) -> Result<Json<Vec<StoryActivity>>, AppError> {
    Ok(Json(repo::list_activity(&state.db, id, &q).await?))
}

// --- Relations --------------------------------------------------------------

#[derive(serde::Serialize)]
pub struct RelationsResponse {
    pub blocks: Vec<Uuid>,
    pub blocked_by: Vec<Uuid>,
}

pub async fn list_relations(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
    Path(id): Path<Uuid>,
) -> Result<Json<RelationsResponse>, AppError> {
    let rows = repo::relations_for(&state.db, id).await?;
    let (mut blocks, mut blocked_by) = (Vec::new(), Vec::new());
    for r in rows {
        if r.from_story_id == id {
            blocks.push(r.to_story_id);
        } else if r.to_story_id == id {
            blocked_by.push(r.from_story_id);
        }
    }
    Ok(Json(RelationsResponse { blocks, blocked_by }))
}

pub async fn create_relation(
    State(state): State<AppState>,
    Extension(identity): Extension<Identity>,
    Path(id): Path<Uuid>,
    Json(req): Json<CreateRelationRequest>,
) -> Result<Json<StoryRelation>, AppError> {
    // Ensure both endpoints exist before inserting so the error is specific.
    repo::get(&state.db, id).await?.ok_or(AppError::NotFound)?;
    repo::get(&state.db, req.to)
        .await?
        .ok_or_else(|| AppError::BadRequest("related story not found".into()))?;

    let row = repo::create_relation(&state.db, id, req.to, req.kind).await?;

    activity::emit(
        &state.db,
        Some(&state.redis),
        id,
        ActivityActor::User,
        &identity.user_id.to_string(),
        activity::RELATION,
        &format!("added {:?} → {}", req.kind, req.to),
        Some(&req.to.to_string()),
    )
    .await;

    Ok(Json(row))
}

pub async fn delete_relation(
    State(state): State<AppState>,
    Extension(identity): Extension<Identity>,
    Path((id, target)): Path<(Uuid, Uuid)>,
    Query(q): Query<RelationKindQuery>,
) -> Result<(), AppError> {
    let kind = q.kind.unwrap_or(RelationKind::Blocks);
    let removed = repo::delete_relation(&state.db, id, target, kind).await?;
    if !removed {
        return Err(AppError::NotFound);
    }
    activity::emit(
        &state.db,
        Some(&state.redis),
        id,
        ActivityActor::User,
        &identity.user_id.to_string(),
        activity::RELATION,
        &format!("removed {:?} → {}", kind, target),
        Some(&target.to_string()),
    )
    .await;
    Ok(())
}

#[derive(Debug, serde::Deserialize, Default)]
pub struct RelationKindQuery {
    #[serde(default)]
    pub kind: Option<RelationKind>,
}

// --- helpers ----------------------------------------------------------------

fn validate_name(name: &str) -> Result<(), AppError> {
    if name.is_empty() {
        return Err(AppError::BadRequest("name required".into()));
    }
    if name.len() > NAME_MAX_BYTES {
        return Err(AppError::BadRequest("name too long".into()));
    }
    Ok(())
}

fn validate_body(body: &str, field: &'static str) -> Result<(), AppError> {
    if body.len() > FIELD_MAX_BYTES {
        return Err(AppError::BadRequest(format!("{field} too large")));
    }
    Ok(())
}

fn validate_branch(b: Option<&str>) -> Result<(), AppError> {
    if let Some(v) = b {
        if v.len() > BRANCH_MAX_BYTES {
            return Err(AppError::BadRequest("branch too long".into()));
        }
    }
    Ok(())
}

fn validate_pr_ref(p: Option<&str>) -> Result<(), AppError> {
    if let Some(v) = p {
        if v.len() > PR_REF_MAX_BYTES {
            return Err(AppError::BadRequest("pr_ref too long".into()));
        }
    }
    Ok(())
}

/// Accept a JSON array (canonical), a plain string (legacy), or missing.
/// Returns a JSON array of `{text, done}` items.
fn normalize_acceptance(v: Option<JsonValue>) -> Result<JsonValue, AppError> {
    match v {
        None => Ok(json!([])),
        Some(JsonValue::Null) => Ok(json!([])),
        Some(JsonValue::String(s)) => {
            let s = s.trim();
            if s.is_empty() {
                Ok(json!([]))
            } else {
                Ok(json!([{"text": s, "done": false}]))
            }
        }
        Some(JsonValue::Array(items)) => {
            let mut out = Vec::with_capacity(items.len());
            for item in items {
                let obj = item
                    .as_object()
                    .ok_or_else(|| AppError::BadRequest(
                        "acceptance_criteria items must be objects".into(),
                    ))?;
                let text = obj
                    .get("text")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| AppError::BadRequest(
                        "acceptance_criteria item missing text".into(),
                    ))?;
                let done = obj.get("done").and_then(|v| v.as_bool()).unwrap_or(false);
                if text.len() > 2000 {
                    return Err(AppError::BadRequest(
                        "acceptance_criteria item too long".into(),
                    ));
                }
                out.push(json!({"text": text, "done": done}));
            }
            Ok(JsonValue::Array(out))
        }
        Some(_) => Err(AppError::BadRequest(
            "acceptance_criteria must be array or string".into(),
        )),
    }
}
