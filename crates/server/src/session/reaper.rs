//! Background reaper that flips sessions whose collector stopped heartbeating
//! into `ended_at = now()`. Without this, the grid tile stays "live" forever
//! after a collector crash (plan §System-Wide Impact).
//!
//! Cadence: 60 s tick. Threshold: last_heartbeat_at > 90 s old (= 3 missed
//! heartbeats, since collectors heartbeat every 30 s per plan Unit 6).

use std::time::Duration;

use chrono::Utc;
use team_presence_shared_types::Frame;

use super::{
    emit,
    model::GridTile,
    repo::{self, mark_ended, reap_stale},
};
use crate::state::AppState;

pub const TICK: Duration = Duration::from_secs(60);
pub const STALE_SECS: i64 = 90;

pub fn spawn(state: AppState) {
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(TICK);
        // Skip the immediate fire so startup doesn't race the first migrations.
        ticker.tick().await;
        loop {
            ticker.tick().await;
            if let Err(e) = tick_once(&state).await {
                tracing::warn!(error = %e, component = "reaper", phase = "tick", "reaper tick failed");
            }
        }
    });
}

async fn tick_once(state: &AppState) -> anyhow::Result<()> {
    let ids = reap_stale(&state.db, STALE_SECS).await?;
    if ids.is_empty() {
        return Ok(());
    }
    tracing::info!(
        count = ids.len(),
        component = "reaper",
        phase = "reaped",
        "marked stale sessions as ended"
    );
    // Emit synthetic session_end + grid tile update per reaped id so viewers
    // flip their tiles grey without a page reload.
    for id in ids {
        let now = Utc::now();
        // mark_ended returns None because reap_stale already set ended_at;
        // we only need the meta snapshot to build the tile.
        let _ = mark_ended(&state.db, id, now, None).await;
        if let Ok(Some(meta)) = repo::get(&state.db, id).await {
            let tile = GridTile::from_meta(&meta, false);
            let frame = Frame::SessionEnd {
                session_id: id,
                ended_at: now,
                exit_code: None,
            };
            emit::emit_frame(&state.redis, id, &frame, Some(&tile)).await;
        }
    }
    Ok(())
}
