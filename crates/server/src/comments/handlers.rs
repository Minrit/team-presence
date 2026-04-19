use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use uuid::Uuid;

use super::model::{Comment, CreateCommentRequest, PatchCommentRequest};
use crate::{
    auth::model::Identity,
    error::AppError,
    state::AppState,
    stories::activity,
};

const BODY_MAX: usize = 10_000;

pub async fn list(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
    Path(story_id): Path<Uuid>,
) -> Result<Json<Vec<Comment>>, AppError> {
    let rows: Vec<Comment> = sqlx::query_as::<_, Comment>(
        r#"SELECT * FROM comments
           WHERE story_id = $1
           ORDER BY created_at ASC"#,
    )
    .bind(story_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn create(
    State(state): State<AppState>,
    Extension(identity): Extension<Identity>,
    Path(story_id): Path<Uuid>,
    Json(req): Json<CreateCommentRequest>,
) -> Result<Json<Comment>, AppError> {
    let body = req.body.trim().to_string();
    if body.is_empty() {
        return Err(AppError::BadRequest("body required".into()));
    }
    if body.len() > BODY_MAX {
        return Err(AppError::BadRequest("body too long".into()));
    }

    // Ensure story exists so we 404 instead of 500 on FK.
    let exists: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM stories WHERE id = $1")
            .bind(story_id)
            .fetch_optional(&state.db)
            .await?;
    if exists.is_none() {
        return Err(AppError::NotFound);
    }

    let row: Comment = sqlx::query_as::<_, Comment>(
        r#"INSERT INTO comments (story_id, author_id, body)
           VALUES ($1, $2, $3)
           RETURNING *"#,
    )
    .bind(story_id)
    .bind(identity.user_id)
    .bind(&body)
    .fetch_one(&state.db)
    .await?;

    activity::emit(
        &state.db,
        Some(&state.redis),
        story_id,
        identity.activity_actor(),
        &identity.user_id.to_string(),
        activity::COMMENT,
        preview(&body, 140).as_str(),
        Some(&row.id.to_string()),
    )
    .await;

    Ok(Json(row))
}

pub async fn patch(
    State(state): State<AppState>,
    Extension(identity): Extension<Identity>,
    Path((story_id, comment_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<PatchCommentRequest>,
) -> Result<Json<Comment>, AppError> {
    let body = req.body.trim().to_string();
    if body.is_empty() {
        return Err(AppError::BadRequest("body required".into()));
    }
    if body.len() > BODY_MAX {
        return Err(AppError::BadRequest("body too long".into()));
    }

    let existing: Option<Comment> = sqlx::query_as::<_, Comment>(
        r#"SELECT * FROM comments WHERE id = $1 AND story_id = $2"#,
    )
    .bind(comment_id)
    .bind(story_id)
    .fetch_optional(&state.db)
    .await?;
    let existing = existing.ok_or(AppError::NotFound)?;

    if existing.author_id != identity.user_id {
        return Err(AppError::Forbidden);
    }

    let row: Comment = sqlx::query_as::<_, Comment>(
        r#"UPDATE comments SET body = $1 WHERE id = $2 RETURNING *"#,
    )
    .bind(&body)
    .bind(comment_id)
    .fetch_one(&state.db)
    .await?;

    activity::emit(
        &state.db,
        Some(&state.redis),
        story_id,
        identity.activity_actor(),
        &identity.user_id.to_string(),
        activity::COMMENT,
        format!("edited: {}", preview(&body, 140)).as_str(),
        Some(&row.id.to_string()),
    )
    .await;

    Ok(Json(row))
}

pub async fn delete(
    State(state): State<AppState>,
    Extension(identity): Extension<Identity>,
    Path((story_id, comment_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    let existing: Option<Comment> = sqlx::query_as::<_, Comment>(
        r#"SELECT * FROM comments WHERE id = $1 AND story_id = $2"#,
    )
    .bind(comment_id)
    .bind(story_id)
    .fetch_optional(&state.db)
    .await?;
    let existing = existing.ok_or(AppError::NotFound)?;

    if existing.author_id != identity.user_id {
        return Err(AppError::Forbidden);
    }

    sqlx::query("DELETE FROM comments WHERE id = $1")
        .bind(comment_id)
        .execute(&state.db)
        .await?;

    activity::emit(
        &state.db,
        Some(&state.redis),
        story_id,
        identity.activity_actor(),
        &identity.user_id.to_string(),
        activity::COMMENT,
        "deleted",
        Some(&comment_id.to_string()),
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

fn preview(body: &str, max: usize) -> String {
    // Respect UTF-8 boundaries when trimming.
    if body.chars().count() <= max {
        return body.to_string();
    }
    let mut out = String::with_capacity(max + 3);
    for (i, ch) in body.chars().enumerate() {
        if i >= max {
            break;
        }
        out.push(ch);
    }
    out.push('…');
    out
}
