//! `/sse/grid` — tile summary feed for the Live/Grid page.
//!
//! On connect: emits one tile per currently-active session (bootstrap the UI
//! from Postgres so the viewer doesn't have to wait for the next heartbeat).
//! Then subscribes to Redis pub/sub `fanout:grid` for live tile updates emitted
//! by `session::emit::emit_frame` and the reaper.

use std::{convert::Infallible, time::Duration};

use axum::{
    extract::State,
    response::{sse::Event, Sse},
};
use futures_util::StreamExt;
use tokio_stream::Stream;

use crate::{
    session::{emit::GRID_CHANNEL, model::GridTile, repo::list_active},
    state::AppState,
};

const KEEPALIVE_EVERY: Duration = Duration::from_secs(15);

pub async fn handler(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let redis = state.redis.clone();
    let db = state.db.clone();

    let stream = async_stream::stream! {
        // 1) Bootstrap from Postgres so the viewer sees currently-live sessions
        //    immediately on first paint rather than waiting for the next emit.
        match list_active(&db).await {
            Ok(rows) => {
                for meta in rows {
                    let tile = GridTile::from_meta(&meta, false);
                    if let Ok(json) = serde_json::to_string(&tile) {
                        yield Ok(Event::default().event("tile").data(json));
                    }
                }
            }
            Err(e) => {
                tracing::warn!(error = %e, phase = "grid_bootstrap", "list_active failed");
            }
        }

        // 2) Subscribe to pub/sub. pubsub requires a dedicated connection.
        let pubsub_conn = match redis.get_async_pubsub().await {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!(error = %e, phase = "grid_pubsub_conn", "connect failed");
                return;
            }
        };
        let mut pubsub = pubsub_conn;
        if let Err(e) = pubsub.subscribe(GRID_CHANNEL).await {
            tracing::warn!(error = %e, phase = "grid_pubsub_sub", "subscribe failed");
            return;
        }

        let mut msg_stream = pubsub.on_message();
        loop {
            match tokio::time::timeout(KEEPALIVE_EVERY, msg_stream.next()).await {
                Ok(Some(msg)) => {
                    let payload: String = match msg.get_payload() {
                        Ok(p) => p,
                        Err(e) => {
                            tracing::warn!(error = %e, phase = "grid_payload", "payload decode failed");
                            continue;
                        }
                    };
                    yield Ok(Event::default().event("tile").data(payload));
                }
                Ok(None) => break, // subscription closed
                Err(_) => {
                    // axum's keep_alive() emits automatically during Pending;
                    // timing out here just lets us re-poll.
                }
            }
        }
    };

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(KEEPALIVE_EVERY)
            .text("keepalive"),
    )
}
