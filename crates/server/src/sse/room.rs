//! `/sse/room/:session_id` — live text stream for a single teammate's session.
//!
//! Protocol (SSE):
//!   - Optional `Last-Event-ID` header (or `?last_event_id=` query) — a Redis
//!     stream id like `1731530000000-0`. Absent / "0" → backfill from start.
//!   - Emits `data: <json frame>\nid: <stream-id>\n\n` for each frame.
//!   - Emits `event: reset\n` if the requested cursor predates the stream's
//!     first entry (trim happened past client's last seen id). Client refetches
//!     from the beginning on reset.
//!   - Keep-alive comment every ~15 s so intermediate proxies don't time out.

use std::{convert::Infallible, time::Duration};

use axum::{
    extract::{Path, Query, State},
    http::{header::HeaderMap, StatusCode},
    response::{sse::Event, Sse},
};
use serde::Deserialize;
use tokio_stream::Stream;
use uuid::Uuid;

use crate::{session::emit::room_key, state::AppState};

#[derive(Deserialize, Default)]
pub struct RoomQuery {
    #[serde(default)]
    pub last_event_id: Option<String>,
}

/// XREAD BLOCK duration. Keep well below the 15 s keep-alive so we wake often
/// enough to emit comments and check for shutdown signals.
const XREAD_BLOCK_MS: usize = 2_000;
const KEEPALIVE_EVERY: Duration = Duration::from_secs(15);
const BACKFILL_PAGE: usize = 1_000;

pub async fn handler(
    State(state): State<AppState>,
    Path(session_id): Path<Uuid>,
    Query(q): Query<RoomQuery>,
    headers: HeaderMap,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, StatusCode> {
    // Validate session exists (404 per plan test scenario).
    let exists: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM sessions_meta WHERE id = $1")
        .bind(session_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if exists.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    // Last-Event-ID header wins over query param (standard SSE reconnect uses header).
    let requested_last = headers
        .get(axum::http::header::HeaderName::from_static("last-event-id"))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .or(q.last_event_id);

    let redis = state.redis.clone();
    let stream = async_stream::stream! {
        let key = room_key(session_id);

        // Dedicated (non-multiplexed) connection — XREAD BLOCK holds the socket.
        let mut conn = match redis.get_multiplexed_async_connection().await {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!(error = %e, phase = "sse_redis_conn", "connect failed");
                yield Ok(Event::default().event("error").data("redis_unavailable"));
                return;
            }
        };

        let mut cursor: String = match &requested_last {
            Some(s) if s != "0" && !s.is_empty() => s.clone(),
            _ => "0".to_string(),
        };

        // Reset detection: if client provided a non-zero cursor and the stream's
        // current first entry is strictly after that cursor, client missed trimmed
        // content → tell them to wipe their buffer and re-fetch.
        if cursor != "0" {
            let first: redis::RedisResult<Vec<(String, Vec<(String, String)>)>> =
                redis::cmd("XRANGE").arg(&key).arg("-").arg("+").arg("COUNT").arg(1)
                    .query_async(&mut conn).await;
            if let Ok(entries) = first {
                if let Some((first_id, _)) = entries.first() {
                    if id_lt(&cursor, first_id) {
                        yield Ok(Event::default().event("reset").data("trim"));
                        cursor = "0".to_string();
                    }
                }
            }
        }

        // Backfill via paginated XRANGE with exclusive start after `cursor`.
        loop {
            let start = if cursor == "0" {
                "-".to_string()
            } else {
                format!("({cursor}")
            };
            let res: redis::RedisResult<Vec<(String, Vec<(String, String)>)>> =
                redis::cmd("XRANGE").arg(&key).arg(&start).arg("+")
                    .arg("COUNT").arg(BACKFILL_PAGE)
                    .query_async(&mut conn).await;
            let entries = match res {
                Ok(e) => e,
                Err(e) => {
                    tracing::warn!(error = %e, phase = "sse_backfill", "xrange failed");
                    break;
                }
            };
            if entries.is_empty() {
                break;
            }
            let last_id = entries.last().map(|(id, _)| id.clone()).unwrap_or_default();
            for (id, fields) in entries {
                let data = fields
                    .into_iter()
                    .find(|(k, _)| k == "data")
                    .map(|(_, v)| v)
                    .unwrap_or_default();
                yield Ok(Event::default().id(id).data(data));
            }
            cursor = last_id;
            if cursor.is_empty() {
                break;
            }
        }

        // Tail loop: XREAD BLOCK short, emit keep-alive on empty ticks.
        let last_keepalive = std::time::Instant::now();
        loop {
            let res: redis::RedisResult<
                Option<Vec<(String, Vec<(String, Vec<(String, String)>)>)>>,
            > = redis::cmd("XREAD")
                .arg("BLOCK").arg(XREAD_BLOCK_MS)
                .arg("COUNT").arg(BACKFILL_PAGE)
                .arg("STREAMS").arg(&key).arg(&cursor)
                .query_async(&mut conn).await;

            match res {
                Ok(Some(streams)) => {
                    for (_stream_name, entries) in streams {
                        for (id, fields) in entries {
                            let data = fields
                                .into_iter()
                                .find(|(k, _)| k == "data")
                                .map(|(_, v)| v)
                                .unwrap_or_default();
                            yield Ok(Event::default().id(id.clone()).data(data));
                            cursor = id;
                        }
                    }
                }
                Ok(None) => {
                    // BLOCK timeout with no data — axum's keep_alive() emits
                    // comments automatically while the stream is Pending; we
                    // just loop back to XREAD.
                    let _ = last_keepalive; // keep the timer for future use
                }
                Err(e) => {
                    tracing::warn!(error = %e, phase = "sse_tail", "xread failed");
                    // Sleep briefly and retry — don't spin the CPU if redis is down.
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(KEEPALIVE_EVERY)
            .text("keepalive"),
    ))
}

/// Returns true when `a` strictly precedes `b` in Redis stream id order.
/// Redis stream ids are `<ms>-<seq>` where both halves fit in u64.
fn id_lt(a: &str, b: &str) -> bool {
    let pa = parse_id(a);
    let pb = parse_id(b);
    pa < pb
}

fn parse_id(s: &str) -> (u64, u64) {
    let (ms, seq) = s.split_once('-').unwrap_or((s, "0"));
    (
        ms.parse::<u64>().unwrap_or(0),
        seq.parse::<u64>().unwrap_or(0),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stream_id_ordering() {
        assert!(id_lt("100-0", "200-0"));
        assert!(id_lt("100-0", "100-1"));
        assert!(!id_lt("100-1", "100-0"));
        assert!(!id_lt("100-0", "100-0"));
    }

    #[test]
    fn malformed_id_defaults_zero() {
        assert_eq!(parse_id("not-a-number"), (0, 0));
        assert_eq!(parse_id("42"), (42, 0));
        assert_eq!(parse_id("42-9"), (42, 9));
    }
}
