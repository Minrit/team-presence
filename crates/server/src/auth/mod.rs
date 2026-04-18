pub mod handlers;
pub mod jwt;
pub mod model;
pub mod password;

use crate::{error::AppError, state::AppState};
use axum::{
    extract::{Request, State},
    http::header,
    middleware::Next,
    response::Response,
};
use model::{ActorKind, Identity};
use sha2::{Digest, Sha256};

const ACTOR_KIND_HEADER: &str = "x-actor-kind";

/// Middleware: extracts identity from either a Bearer JWT (browser access token)
/// or a Bearer collector-token (opaque, hashed in DB).
///
/// Attaches `Identity` to request extensions on success. Rejects with 401 otherwise.
pub async fn require_identity(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let bearer = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .ok_or(AppError::Unauthorized)?
        .trim()
        .to_string();

    // `X-Actor-Kind: agent|system` marks activity audit rows as non-human.
    // Absence / unknown value defaults to `user` — zero-impact on existing
    // clients. This is an audit hint, not a security boundary; upstream
    // token check still applies.
    let actor_kind = req
        .headers()
        .get(ACTOR_KIND_HEADER)
        .and_then(|h| h.to_str().ok())
        .map(str::trim)
        .map(str::to_ascii_lowercase);
    let actor_kind = match actor_kind.as_deref() {
        Some("agent") => ActorKind::Agent,
        Some("system") => ActorKind::System,
        _ => ActorKind::User,
    };

    // Try JWT first (short-lived, cryptographic). Falls through to DB lookup if invalid.
    if let Ok(claims) = jwt::decode_access(&state.jwt.secret, &bearer) {
        req.extensions_mut().insert(Identity {
            user_id: claims.sub,
            actor_kind,
        });
        return Ok(next.run(req).await);
    }

    // Collector token (opaque, hashed). Look up by SHA-256.
    let sha = sha256_hex(&bearer);
    let row: Option<(uuid::Uuid,)> = sqlx::query_as(
        "SELECT user_id FROM collector_tokens WHERE token_sha256 = $1 AND revoked_at IS NULL",
    )
    .bind(&sha)
    .fetch_optional(&state.db)
    .await?;

    let user_id = row.ok_or(AppError::Unauthorized)?.0;

    // Best-effort last_seen_at update (ignore errors — this is telemetry, not security).
    let _ = sqlx::query("UPDATE collector_tokens SET last_seen_at = now() WHERE token_sha256 = $1")
        .bind(&sha)
        .execute(&state.db)
        .await;

    req.extensions_mut().insert(Identity {
        user_id,
        actor_kind,
    });
    Ok(next.run(req).await)
}

pub(crate) fn sha256_hex(input: &str) -> String {
    let mut h = Sha256::new();
    h.update(input.as_bytes());
    format!("{:x}", h.finalize())
}
