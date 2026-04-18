//! `/sse/story/:id/activity` — live push of story activity log rows.
//!
//! Shape is intentionally cheaper than the room SSE:
//!   * No backfill — the initial page comes from `GET /api/v1/stories/:id/activity`
//!     and this endpoint is a tail-only subscription for new rows.
//!   * Redis Pub/Sub channel `story_activity:{id}` carries each new row as JSON.
//!   * Keep-alive every 15s so proxies don't tear down the stream.
//!
//! Activity is append-only audit, never gating — if Redis hiccups we emit an
//! `error` SSE event and let the browser reconnect (refresh restores the
//! full timeline via REST).

use std::{convert::Infallible, time::Duration};

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{sse::Event, Sse},
};
use futures_util::StreamExt;
use tokio_stream::Stream;
use uuid::Uuid;

use crate::{state::AppState, stories::activity};

const KEEPALIVE_EVERY: Duration = Duration::from_secs(15);

pub async fn handler(
    State(state): State<AppState>,
    Path(story_id): Path<Uuid>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, StatusCode> {
    // Verify story exists — mirrors the room handler's 404 contract.
    let exists: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM stories WHERE id = $1")
        .bind(story_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if exists.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    let redis = state.redis.clone();
    let channel = activity::channel_name(story_id);

    let stream = async_stream::stream! {
        let conn = match redis.get_async_pubsub().await {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    story_id = %story_id,
                    phase = "sse_activity_conn",
                    "pubsub connect failed"
                );
                yield Ok(Event::default().event("error").data("redis_unavailable"));
                return;
            }
        };
        let mut pubsub = conn;
        if let Err(e) = pubsub.subscribe(&channel).await {
            tracing::warn!(
                error = %e,
                story_id = %story_id,
                phase = "sse_activity_subscribe",
                "subscribe failed"
            );
            yield Ok(Event::default().event("error").data("subscribe_failed"));
            return;
        }

        let mut msg_stream = pubsub.on_message();
        while let Some(msg) = msg_stream.next().await {
            let payload: String = match msg.get_payload() {
                Ok(s) => s,
                Err(e) => {
                    tracing::warn!(
                        error = %e,
                        phase = "sse_activity_payload",
                        "pubsub payload decode failed"
                    );
                    continue;
                }
            };
            yield Ok(Event::default().event("activity").data(payload));
        }
    };

    Ok(Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(KEEPALIVE_EVERY)
            .text("keepalive"),
    ))
}
