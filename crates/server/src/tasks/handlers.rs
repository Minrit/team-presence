use axum::{
    extract::{Path, State},
    Extension, Json,
};
use uuid::Uuid;

use super::model::{CreateTaskRequest, PatchTaskRequest, Task};
use super::repo::{self, TITLE_MAX_BYTES};
use crate::{auth::model::Identity, error::AppError, state::AppState};

pub async fn create(
    State(state): State<AppState>,
    Extension(identity): Extension<Identity>,
    Path(story_id): Path<Uuid>,
    Json(req): Json<CreateTaskRequest>,
) -> Result<Json<Task>, AppError> {
    validate_title(&req.title)?;
    let task = repo::create(
        &state.db,
        identity.user_id,
        story_id,
        req.title.trim(),
        req.position,
    )
    .await?;
    Ok(Json(task))
}

pub async fn patch(
    State(state): State<AppState>,
    Extension(identity): Extension<Identity>,
    Path(id): Path<Uuid>,
    Json(req): Json<PatchTaskRequest>,
) -> Result<Json<Task>, AppError> {
    if let Some(t) = &req.title {
        validate_title(t)?;
    }
    let task = repo::patch(
        &state.db,
        identity.user_id,
        id,
        req.title.as_deref().map(str::trim),
        req.done,
        req.position,
    )
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(task))
}

pub async fn delete(
    State(state): State<AppState>,
    Extension(identity): Extension<Identity>,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    let removed = repo::delete(&state.db, identity.user_id, id).await?;
    if !removed {
        return Err(AppError::NotFound);
    }
    Ok(())
}

fn validate_title(title: &str) -> Result<(), AppError> {
    let t = title.trim();
    if t.is_empty() {
        return Err(AppError::BadRequest("task title required".into()));
    }
    if t.len() > TITLE_MAX_BYTES {
        return Err(AppError::BadRequest("task title too long".into()));
    }
    Ok(())
}
