use crate::{auth::model::Identity, auth::sha256_hex, error::AppError, state::AppState};
use axum::{
    extract::{Path, State},
    Extension, Json,
};
use chrono::{DateTime, Utc};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct MintRequest {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct MintResponse {
    pub id: Uuid,
    pub name: String,
    pub token: String,
    pub created_at: DateTime<Utc>,
}

pub async fn mint(
    State(state): State<AppState>,
    Extension(identity): Extension<Identity>,
    Json(req): Json<MintRequest>,
) -> Result<Json<MintResponse>, AppError> {
    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("name required".into()));
    }

    let mut buf = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut buf);
    let token = format!("tp_{}", hex::encode(buf));
    let token_sha = sha256_hex(&token);

    let row: (Uuid, DateTime<Utc>) = sqlx::query_as(
        r#"INSERT INTO collector_tokens (user_id, name, token_sha256)
           VALUES ($1, $2, $3)
           RETURNING id, created_at"#,
    )
    .bind(identity.user_id)
    .bind(&req.name)
    .bind(&token_sha)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(MintResponse {
        id: row.0,
        name: req.name,
        token,
        created_at: row.1,
    }))
}

/// Everyone-admin: any authenticated user can revoke any collector token.
/// Codified in the plan as an accepted trade for "no role tiers".
pub async fn revoke(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    let result =
        sqlx::query("UPDATE collector_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL")
            .bind(id)
            .execute(&state.db)
            .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}
