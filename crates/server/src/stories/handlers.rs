use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use uuid::Uuid;

use super::model::{CreateStoryRequest, ListStoriesQuery, PatchStoryRequest, Story, StoryStatus};
use super::repo::{self, FIELD_MAX_BYTES, NAME_MAX_BYTES};
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
    let ac = req.acceptance_criteria.unwrap_or_default();
    validate_body(&desc, "description")?;
    validate_body(&ac, "acceptance_criteria")?;

    let story = repo::create(
        &state.db,
        identity.user_id,
        name,
        &desc,
        &ac,
        req.status.unwrap_or(StoryStatus::Todo),
        req.owner_id,
        req.repo.as_deref(),
        req.sprint_id,
    )
    .await?;
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
    if let Some(a) = &req.acceptance_criteria {
        validate_body(a, "acceptance_criteria")?;
    }

    let story = repo::patch(
        &state.db,
        id,
        identity.user_id,
        req.name.as_deref().map(str::trim),
        req.description.as_deref(),
        req.acceptance_criteria.as_deref(),
        req.status,
        req.owner_id,
        req.repo.as_ref().map(|o| o.as_deref()),
        req.sprint_id,
    )
    .await?
    .ok_or(AppError::NotFound)?;
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
