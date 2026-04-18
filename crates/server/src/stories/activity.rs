//! Story activity log emission helpers.
//!
//! Every story mutation that is user-visible on the timeline writes one row
//! here. Activity is append-only audit, never gating — any DB or Redis hiccup
//! must log + continue so the originating PATCH still succeeds.
//!
//! The Redis Pub/Sub channel `story_activity:{id}` is used by the per-story
//! SSE endpoint (Unit 11) to push rows live. The initial row insert happens
//! regardless of Redis state so refresh still reconstructs the full history.

use redis::AsyncCommands;
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use super::model::{ActivityActor, StoryActivity};

pub const STATUS_CHANGE: &str = "status_change";
pub const EDIT: &str = "edit";
pub const CLAIM: &str = "claim";
pub const CREATE: &str = "create";
pub const COMMENT: &str = "comment";
pub const RELATION: &str = "relation";

#[derive(Debug, Serialize)]
struct ActivityChannelPayload<'a> {
    #[serde(flatten)]
    row: &'a StoryActivity,
}

pub fn channel_name(story_id: Uuid) -> String {
    format!("story_activity:{story_id}")
}

#[allow(clippy::too_many_arguments)]
pub async fn emit(
    db: &PgPool,
    redis: Option<&redis::Client>,
    story_id: Uuid,
    actor_type: ActivityActor,
    actor_ref: &str,
    kind: &str,
    text: &str,
    r#ref: Option<&str>,
) {
    let row: Result<StoryActivity, _> = sqlx::query_as::<_, StoryActivity>(
        r#"INSERT INTO story_activity
               (story_id, actor_type, actor_ref, kind, text, ref)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *"#,
    )
    .bind(story_id)
    .bind(actor_type)
    .bind(actor_ref)
    .bind(kind)
    .bind(text)
    .bind(r#ref)
    .fetch_one(db)
    .await;

    let row = match row {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!(
                error = %e,
                story_id = %story_id,
                kind = %kind,
                component = "server",
                phase = "activity_emit",
                "activity insert failed; skipping fan-out"
            );
            return;
        }
    };

    let Some(redis) = redis else { return };
    let payload = match serde_json::to_string(&ActivityChannelPayload { row: &row }) {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!(
                error = %e,
                story_id = %story_id,
                component = "server",
                phase = "activity_serialize",
                "activity serialize failed"
            );
            return;
        }
    };

    match redis.get_multiplexed_async_connection().await {
        Ok(mut conn) => {
            if let Err(e) = conn
                .publish::<_, _, ()>(channel_name(story_id), payload)
                .await
            {
                tracing::warn!(
                    error = %e,
                    story_id = %story_id,
                    component = "server",
                    phase = "activity_publish",
                    "activity publish failed; row is persisted"
                );
            }
        }
        Err(e) => {
            tracing::warn!(
                error = %e,
                story_id = %story_id,
                component = "server",
                phase = "activity_publish_conn",
                "activity publish connection failed; row is persisted"
            );
        }
    }
}
