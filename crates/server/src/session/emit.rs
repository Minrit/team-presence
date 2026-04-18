//! Redis Streams fan-out for live session frames.
//!
//! Semantics (per plan §Key Technical Decisions):
//! - `XADD room:{session_id} MAXLEN ~ 100000 * data <json>` — ringbuffer safety cap
//! - `EXPIRE room:{session_id} 86400` — actual retention (24 h rolling window per R16)
//! - `PUBLISH fanout:{session_id} <json>` — pub/sub nudge for live tail listeners
//! - `PUBLISH fanout:grid <json>` — compact grid tile update
//!
//! Failure mode: emit failures MUST NOT take down the WS ingestion
//! (mirrors lobsterpool `crew_event::emit`). We log a warn and return Ok(()).
//! Metadata was already persisted by the caller before reaching here, so
//! Postgres remains the source of truth.

use redis::AsyncCommands;
use serde::Serialize;
use team_presence_shared_types::Frame;
use uuid::Uuid;

use super::model::GridTile;

pub const ROOM_MAXLEN: usize = 100_000;
pub const ROOM_TTL_SECS: usize = 24 * 3600;

pub fn room_key(session_id: Uuid) -> String {
    format!("room:{session_id}")
}

pub fn fanout_channel(session_id: Uuid) -> String {
    format!("fanout:{session_id}")
}

pub const GRID_CHANNEL: &str = "fanout:grid";

/// Emit a typed frame to the session's stream + pubsub + grid (if relevant).
///
/// `grid_tile` is optional — callers pass one when the frame changes tile state
/// (start / end / meta update), None when only content/heartbeat.
pub async fn emit_frame(
    redis: &redis::Client,
    session_id: Uuid,
    frame: &Frame,
    grid_tile: Option<&GridTile>,
) {
    // Best-effort serialize; if this ever fails, something in Frame is broken,
    // not a runtime condition — log and bail, don't escalate.
    let payload = match serde_json::to_string(frame) {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!(
                error = %e,
                session_id = %session_id,
                component = "server",
                phase = "emit_serialize",
                "frame serialize failed"
            );
            return;
        }
    };

    match try_emit(redis, session_id, &payload, grid_tile).await {
        Ok(()) => {}
        Err(e) => {
            // Graceful degradation: Redis hiccup shouldn't drop the WS.
            tracing::warn!(
                error = %e,
                session_id = %session_id,
                component = "server",
                phase = "emit_redis",
                "redis emit failed; continuing (metadata already persisted)"
            );
        }
    }
}

async fn try_emit(
    redis: &redis::Client,
    session_id: Uuid,
    payload: &str,
    grid_tile: Option<&GridTile>,
) -> redis::RedisResult<()> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let room = room_key(session_id);

    // Approximate trim (`~`) so Redis can skip exact macroalignment for speed.
    let _id: String = redis::cmd("XADD")
        .arg(&room)
        .arg("MAXLEN")
        .arg("~")
        .arg(ROOM_MAXLEN)
        .arg("*")
        .arg("data")
        .arg(payload)
        .query_async(&mut conn)
        .await?;

    // Reset (or set) TTL on every XADD — retention is 24 h since last activity.
    let _: () = conn.expire(&room, ROOM_TTL_SECS as i64).await?;

    // Pub/sub nudge — readers blocking on XREAD already pick up, but pub/sub
    // is the cheaper tail signal for grid / activity channels.
    let _: () = conn.publish(fanout_channel(session_id), payload).await?;

    if let Some(tile) = grid_tile {
        let tile_payload = serde_json::to_string(tile).unwrap_or_else(|_| "{}".into());
        let _: () = conn.publish(GRID_CHANNEL, tile_payload).await?;
    }

    Ok(())
}

/// Publish a plain JSON-serializable payload to an arbitrary channel.
/// Used by the reaper to push synthetic `grid` updates when sessions end.
pub async fn publish_raw<T: Serialize>(
    redis: &redis::Client,
    channel: &str,
    payload: &T,
) -> redis::RedisResult<()> {
    let s = serde_json::to_string(payload).map_err(|e| {
        redis::RedisError::from((
            redis::ErrorKind::TypeError,
            "serialize failed",
            e.to_string(),
        ))
    })?;
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let _: () = conn.publish(channel, s).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use team_presence_shared_types::{CliKind, Content, ContentRole, Frame};
    use uuid::Uuid;

    #[test]
    fn room_key_shape() {
        let id = Uuid::nil();
        assert_eq!(room_key(id), format!("room:{id}"));
    }

    #[test]
    fn fanout_channel_shape() {
        let id = Uuid::nil();
        assert_eq!(fanout_channel(id), format!("fanout:{id}"));
    }

    #[test]
    fn grid_channel_literal() {
        assert_eq!(GRID_CHANNEL, "fanout:grid");
    }

    #[test]
    fn frame_round_trip_for_emit() {
        // Catch accidental Serialize drift — the emit path depends on this.
        let f = Frame::SessionContent {
            session_id: Uuid::nil(),
            role: ContentRole::Assistant,
            text: Content("x".into()),
            ts: Utc::now(),
        };
        let s = serde_json::to_string(&f).unwrap();
        let back: Frame = serde_json::from_str(&s).unwrap();
        assert!(matches!(back, Frame::SessionContent { .. }));
    }

    #[test]
    fn session_start_round_trip_preserves_cli_kind() {
        let f = Frame::SessionStart {
            session_id: Uuid::nil(),
            cli: CliKind::ClaudeCode,
            cwd: "/tmp".into(),
            git_remote: None,
            git_branch: None,
            transcript_path: None,
            started_at: Utc::now(),
        };
        let s = serde_json::to_string(&f).unwrap();
        assert!(s.contains("\"claude_code\""));
    }
}
