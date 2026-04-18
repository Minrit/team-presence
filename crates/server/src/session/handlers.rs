//! HTTP handlers for sessions metadata. Live frames flow through WS/SSE
//! (see `ws::collector` and `sse::room`); this surface is for metadata
//! queries + the one-click 改派 (reassign) PATCH from Unit 9.

use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    auth::model::Identity,
    error::AppError,
    session::{emit, model::GridTile, repo},
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct ReassignRequest {
    /// `Some(Some(uuid))` → point at story, `Some(None)` → unassign,
    /// `None` → field absent (unchanged). Mirrors stories handler's tri-state.
    #[serde(default, deserialize_with = "crate::stories::model::de_opt_opt")]
    pub detected_story_id: Option<Option<Uuid>>,
}

#[derive(Debug, Serialize)]
pub struct SessionListItem {
    pub id: Uuid,
    pub user_id: Uuid,
    pub agent_kind: String,
    pub cwd: String,
    pub detected_story_id: Option<Uuid>,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub ended_at: Option<chrono::DateTime<chrono::Utc>>,
}

pub async fn list_active(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
) -> Result<Json<Vec<SessionListItem>>, AppError> {
    let rows = repo::list_active(&state.db).await?;
    Ok(Json(
        rows.into_iter()
            .map(|m| SessionListItem {
                id: m.id,
                user_id: m.user_id,
                agent_kind: m.agent_kind,
                cwd: m.cwd,
                detected_story_id: m.detected_story_id,
                started_at: m.started_at,
                ended_at: m.ended_at,
            })
            .collect(),
    ))
}

pub async fn reassign(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
    Path(id): Path<Uuid>,
    Json(req): Json<ReassignRequest>,
) -> Result<Json<SessionListItem>, AppError> {
    // Absent field → nothing to do. Explicit null unassigns.
    let Some(patch) = req.detected_story_id else {
        return Err(AppError::BadRequest("detected_story_id required".into()));
    };

    let updated: Option<crate::session::model::SessionMeta> = sqlx::query_as(
        r#"
        UPDATE sessions_meta
        SET detected_story_id = $2, last_activity_at = now()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(patch)
    .fetch_optional(&state.db)
    .await?;

    let meta = updated.ok_or(AppError::NotFound)?;

    // Emit a grid tile refresh so Kanban 🔴 dots recompute across viewers.
    let tile = GridTile::from_meta(&meta, false);
    let _ = emit::publish_raw(&state.redis, emit::GRID_CHANNEL, &tile).await;

    Ok(Json(SessionListItem {
        id: meta.id,
        user_id: meta.user_id,
        agent_kind: meta.agent_kind,
        cwd: meta.cwd,
        detected_story_id: meta.detected_story_id,
        started_at: meta.started_at,
        ended_at: meta.ended_at,
    }))
}
