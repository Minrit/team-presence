//! `/ws/collector` — accepts a laptop-side collector, authenticates via Bearer
//! collector token (not JWT — collectors use opaque long-lived tokens, see Unit 2),
//! persists metadata to `sessions_meta` FIRST, then emits the frame to Redis.
//!
//! Close codes:
//!   - 1000 normal
//!   - 1012 server-initiated restart (mirrors lobsterpool `terminal_ws.rs`)
//!   - 4400 protocol error (bad JSON / unknown frame)
//!   - 4401 token revoked mid-stream
//!
//! Content frames are NEVER logged. `Frame`'s `Content` newtype makes this
//! lexically enforced — `tracing::debug!(?frame)` renders `<content:N bytes>`.

use axum::{
    extract::{
        ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use futures_util::{SinkExt, StreamExt};
use std::borrow::Cow;
use std::time::Duration;
use team_presence_shared_types::Frame;
use uuid::Uuid;

use crate::{
    auth::sha256_hex,
    session::{
        emit, link,
        model::GridTile,
        repo::{bump_activity, bump_heartbeat, mark_ended, upsert_session_start},
    },
    state::AppState,
};

/// Result of the bearer check: we need both user_id (for sessions_meta.user_id)
/// and collector_token_id (for sessions_meta.collector_token_id FK).
struct CollectorAuth {
    user_id: Uuid,
    collector_token_id: Uuid,
    token_sha256: String,
}

async fn authenticate(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<CollectorAuth, StatusCode> {
    let bearer = headers
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?
        .trim()
        .to_string();

    if bearer.is_empty() {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let sha = sha256_hex(&bearer);
    let row: Option<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT id, user_id FROM collector_tokens \
         WHERE token_sha256 = $1 AND revoked_at IS NULL",
    )
    .bind(&sha)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, component = "server", phase = "ws_auth_db", "db lookup failed");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let (id, user_id) = row.ok_or(StatusCode::UNAUTHORIZED)?;
    Ok(CollectorAuth {
        user_id,
        collector_token_id: id,
        token_sha256: sha,
    })
}

pub async fn ws_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    ws: WebSocketUpgrade,
) -> Response {
    let auth = match authenticate(&state, &headers).await {
        Ok(a) => a,
        Err(code) => return (code, "unauthorized").into_response(),
    };

    let token_id = auth.collector_token_id;
    ws.on_upgrade(move |socket| async move {
        tracing::info!(
            collector_token_id = %token_id,
            user_id = %auth.user_id,
            component = "server",
            phase = "ws_connect",
            "collector connected"
        );
        run_session(state, socket, auth).await;
        tracing::info!(
            collector_token_id = %token_id,
            component = "server",
            phase = "ws_close",
            "collector disconnected"
        );
    })
}

/// Revocation re-check threshold: avoid DB hit on every frame; re-verify on the
/// heartbeat cadence so a revoke takes effect within ~one heartbeat (30 s).
const REVOKE_CHECK_EVERY: Duration = Duration::from_secs(30);

async fn run_session(state: AppState, socket: WebSocket, auth: CollectorAuth) {
    let (mut tx, mut rx) = {
        let (sink, stream) = socket.split();
        (sink, stream)
    };
    let mut last_revoke_check = std::time::Instant::now();
    let mut current_muted = false;

    loop {
        tokio::select! {
            msg = rx.next() => {
                let msg = match msg {
                    Some(Ok(m)) => m,
                    Some(Err(e)) => {
                        tracing::warn!(error = %e, phase = "ws_read_err", "read failed");
                        break;
                    }
                    None => break,
                };
                match msg {
                    Message::Text(text) => {
                        if let Some(muted) = handle_text(&state, &auth, &text).await {
                            current_muted = muted;
                        } else {
                            // protocol error — close 4400 and exit
                            let _ = tx.send(Message::Close(Some(CloseFrame {
                                code: 4400,
                                reason: Cow::Borrowed("bad frame"),
                            }))).await;
                            break;
                        }
                    }
                    Message::Binary(_) => {
                        // Binary not used — collector ships JSON text frames.
                        let _ = tx.send(Message::Close(Some(CloseFrame {
                            code: 4400,
                            reason: Cow::Borrowed("binary unsupported"),
                        }))).await;
                        break;
                    }
                    Message::Ping(p) => {
                        let _ = tx.send(Message::Pong(p)).await;
                    }
                    Message::Pong(_) => {}
                    Message::Close(_) => break,
                }

                // Periodic revocation re-check — cheap SELECT.
                if last_revoke_check.elapsed() >= REVOKE_CHECK_EVERY {
                    last_revoke_check = std::time::Instant::now();
                    if !still_valid(&state, &auth.token_sha256).await {
                        let _ = tx.send(Message::Close(Some(CloseFrame {
                            code: 4401,
                            reason: Cow::Borrowed("token revoked"),
                        }))).await;
                        break;
                    }
                }
            }
        }
    }

    let _ = current_muted; // reserved for future control frames
}

async fn still_valid(state: &AppState, token_sha: &str) -> bool {
    sqlx::query_scalar::<_, i32>(
        "SELECT 1 FROM collector_tokens WHERE token_sha256 = $1 AND revoked_at IS NULL",
    )
    .bind(token_sha)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .is_some()
}

/// Returns Some(muted_state) when the frame parsed and was handled, None when
/// the payload was protocol-invalid (caller closes with 4400).
async fn handle_text(state: &AppState, auth: &CollectorAuth, text: &str) -> Option<bool> {
    let frame: Frame = match serde_json::from_str(text) {
        Ok(f) => f,
        Err(e) => {
            tracing::warn!(
                error = %e,
                component = "server",
                phase = "frame_parse",
                len = text.len(),
                "malformed collector frame"
            );
            return None;
        }
    };

    match &frame {
        Frame::SessionStart {
            session_id,
            cli,
            cwd,
            git_remote,
            git_branch,
            transcript_path: _,
            started_at,
        } => {
            let kind_str = cli.as_str();
            let upsert = upsert_session_start(
                &state.db,
                *session_id,
                auth.collector_token_id,
                auth.user_id,
                kind_str,
                cwd,
                git_remote.as_deref(),
                git_branch.as_deref(),
                *started_at,
            )
            .await;

            match upsert {
                Ok(mut meta) => {
                    // Attempt regex-based story auto-link on fresh sessions.
                    // Only runs when the row doesn't already have an assignment
                    // (so a prior 改派 can't be overwritten by a reconnect).
                    if meta.detected_story_id.is_none() {
                        if let Ok(Some(sid)) = link::resolve_story_id(
                            &state.db,
                            git_branch.as_deref(),
                            Some(cwd.as_str()),
                        )
                        .await
                        {
                            let updated: Option<crate::session::model::SessionMeta> =
                                sqlx::query_as(
                                    "UPDATE sessions_meta SET detected_story_id = $2 \
                                     WHERE id = $1 AND detected_story_id IS NULL RETURNING *",
                                )
                                .bind(meta.id)
                                .bind(sid)
                                .fetch_optional(&state.db)
                                .await
                                .ok()
                                .flatten();
                            if let Some(m) = updated {
                                meta = m;
                            }
                        }
                    }
                    let tile = GridTile::from_meta(&meta, false);
                    emit::emit_frame(&state.redis, *session_id, &frame, Some(&tile)).await;
                }
                Err(e) => {
                    // Meta persistence failure — DO NOT emit content without meta.
                    tracing::error!(
                        error = %e,
                        session_id = %session_id,
                        component = "server",
                        phase = "session_start_persist",
                        "sessions_meta insert failed; skipping emit"
                    );
                }
            }
            Some(false)
        }
        Frame::SessionContent { session_id, .. } => {
            let _ = bump_activity(&state.db, *session_id).await;
            emit::emit_frame(&state.redis, *session_id, &frame, None).await;
            Some(false)
        }
        Frame::SessionEnd {
            session_id,
            ended_at,
            exit_code,
        } => {
            match mark_ended(&state.db, *session_id, *ended_at, *exit_code).await {
                Ok(Some(meta)) => {
                    let tile = GridTile::from_meta(&meta, false);
                    emit::emit_frame(&state.redis, *session_id, &frame, Some(&tile)).await;
                }
                Ok(None) => {
                    // Session was already ended (idempotent); still forward the frame
                    // so viewers get the end marker.
                    emit::emit_frame(&state.redis, *session_id, &frame, None).await;
                }
                Err(e) => {
                    tracing::warn!(
                        error = %e,
                        session_id = %session_id,
                        component = "server",
                        phase = "session_end_persist",
                        "sessions_meta update failed"
                    );
                }
            }
            Some(false)
        }
        Frame::Heartbeat {
            active_session_ids,
            muted,
            ..
        } => {
            let _ = bump_heartbeat(&state.db, active_session_ids).await;
            // Per-session grid tile refresh so viewers see "私播中" flip on/off
            // within one heartbeat without needing a content frame to arrive.
            for sid in active_session_ids {
                if let Ok(Some(meta)) = crate::session::repo::get(&state.db, *sid).await {
                    let tile = GridTile::from_meta(&meta, *muted);
                    let _ = emit::publish_raw(&state.redis, emit::GRID_CHANNEL, &tile).await;
                }
            }
            Some(*muted)
        }
    }
}
