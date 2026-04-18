use axum::{
    extract::{Path, State},
    Extension, Json,
};
use uuid::Uuid;

use super::{
    model::{CreateSprintRequest, PatchSprintRequest, Sprint},
    repo::{self, NAME_MAX_BYTES},
};
use crate::{auth::model::Identity, error::AppError, state::AppState};

pub async fn create(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
    Json(req): Json<CreateSprintRequest>,
) -> Result<Json<Sprint>, AppError> {
    let name = req.name.trim();
    validate_name(name)?;
    if req.end_date < req.start_date {
        return Err(AppError::BadRequest("end_date before start_date".into()));
    }
    let sprint = repo::create(&state.db, name, req.start_date, req.end_date).await?;
    Ok(Json(sprint))
}

pub async fn list(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
) -> Result<Json<Vec<Sprint>>, AppError> {
    Ok(Json(repo::list(&state.db).await?))
}

pub async fn get_one(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
    Path(id): Path<Uuid>,
) -> Result<Json<Sprint>, AppError> {
    Ok(Json(repo::get(&state.db, id).await?.ok_or(AppError::NotFound)?))
}

pub async fn patch(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
    Path(id): Path<Uuid>,
    Json(req): Json<PatchSprintRequest>,
) -> Result<Json<Sprint>, AppError> {
    if let Some(n) = &req.name {
        validate_name(n.trim())?;
    }
    if let (Some(s), Some(e)) = (req.start_date, req.end_date) {
        if e < s {
            return Err(AppError::BadRequest("end_date before start_date".into()));
        }
    }
    let sprint = repo::patch(
        &state.db,
        id,
        req.name.as_deref().map(str::trim),
        req.start_date,
        req.end_date,
    )
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(sprint))
}

pub async fn delete(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    if !repo::delete(&state.db, id).await? {
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
