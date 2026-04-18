use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use uuid::Uuid;

use super::model::{
    CreateStoryRequest, ListStoriesQuery, PatchStoryRequest, Story, StoryStatus, StoryWithTasks,
};
use super::repo::{self, DESCRIPTION_MAX_BYTES, TITLE_MAX_BYTES};
use crate::{auth::model::Identity, error::AppError, state::AppState, tasks::repo as task_repo};

pub async fn create(
    State(state): State<AppState>,
    Extension(identity): Extension<Identity>,
    Json(req): Json<CreateStoryRequest>,
) -> Result<Json<Story>, AppError> {
    validate_title(&req.title)?;
    let desc = req.description.unwrap_or_default();
    if desc.len() > DESCRIPTION_MAX_BYTES {
        return Err(AppError::BadRequest("description too large".into()));
    }
    let story = repo::create(
        &state.db,
        identity.user_id,
        req.title.trim(),
        &desc,
        req.status.unwrap_or(StoryStatus::Todo),
        req.owner_id,
        req.repo.as_deref(),
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
) -> Result<Json<StoryWithTasks>, AppError> {
    let story = repo::get(&state.db, id).await?.ok_or(AppError::NotFound)?;
    let tasks = task_repo::list_by_story(&state.db, id).await?;
    Ok(Json(StoryWithTasks { story, tasks }))
}

pub async fn patch(
    State(state): State<AppState>,
    Extension(identity): Extension<Identity>,
    Path(id): Path<Uuid>,
    Json(req): Json<PatchStoryRequest>,
) -> Result<Json<Story>, AppError> {
    if let Some(t) = &req.title {
        validate_title(t)?;
    }
    if let Some(d) = &req.description {
        if d.len() > DESCRIPTION_MAX_BYTES {
            return Err(AppError::BadRequest("description too large".into()));
        }
    }

    let story = repo::patch(
        &state.db,
        id,
        identity.user_id,
        req.title.as_deref().map(str::trim),
        req.description.as_deref(),
        req.status,
        req.owner_id,
        req.repo.as_ref().map(|o| o.as_deref()),
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

fn validate_title(title: &str) -> Result<(), AppError> {
    let t = title.trim();
    if t.is_empty() {
        return Err(AppError::BadRequest("title required".into()));
    }
    if t.len() > TITLE_MAX_BYTES {
        return Err(AppError::BadRequest("title too long".into()));
    }
    Ok(())
}
