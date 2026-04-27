use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::model::SessionMeta;

/// Upsert on SessionStart: idempotent if the collector reconnects after a
/// transient network blip and re-emits start for an already-known session.
#[allow(clippy::too_many_arguments)]
pub async fn upsert_session_start(
    db: &PgPool,
    session_id: Uuid,
    collector_token_id: Uuid,
    user_id: Uuid,
    agent_kind: &str,
    cwd: &str,
    git_remote: Option<&str>,
    git_branch: Option<&str>,
    started_at: DateTime<Utc>,
) -> sqlx::Result<SessionMeta> {
    match sqlx::query_as::<_, SessionMeta>(
        r#"
        INSERT INTO sessions_meta (
            id, collector_token_id, user_id, agent_kind, cwd, git_remote, git_branch,
            started_at, last_heartbeat_at, last_activity_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
        ON CONFLICT (id) DO UPDATE SET
            cwd = EXCLUDED.cwd,
            git_remote = EXCLUDED.git_remote,
            git_branch = EXCLUDED.git_branch,
            last_heartbeat_at = now(),
            last_activity_at = now()
        RETURNING *
        "#,
    )
    .bind(session_id)
    .bind(collector_token_id)
    .bind(user_id)
    .bind(agent_kind)
    .bind(cwd)
    .bind(git_remote)
    .bind(git_branch)
    .bind(started_at)
    .fetch_one(db)
    .await
    {
        Ok(meta) => Ok(meta),
        Err(e) => {
            if let sqlx::Error::Database(db_err) = &e {
                let msg = db_err.message();
                if msg.contains("sessions_meta_agent_kind_check")
                    || msg.contains("violates check constraint")
                {
                    tracing::error!(
                        component = "server",
                        phase = "session_start_agent_kind_rejected",
                        agent_kind = agent_kind,
                        error = %msg,
                        "agent_kind rejected by DB constraint; run latest migrations to include new agent kinds"
                    );
                }
            }
            Err(e)
        }
    }
}

pub async fn bump_activity(db: &PgPool, session_id: Uuid) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE sessions_meta SET last_activity_at = now(), last_heartbeat_at = now() \
         WHERE id = $1 AND ended_at IS NULL",
    )
    .bind(session_id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn bump_heartbeat(db: &PgPool, session_ids: &[Uuid]) -> sqlx::Result<()> {
    if session_ids.is_empty() {
        return Ok(());
    }
    sqlx::query(
        "UPDATE sessions_meta SET last_heartbeat_at = now() \
         WHERE id = ANY($1) AND ended_at IS NULL",
    )
    .bind(session_ids)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn mark_ended(
    db: &PgPool,
    session_id: Uuid,
    ended_at: DateTime<Utc>,
    exit_code: Option<i32>,
) -> sqlx::Result<Option<SessionMeta>> {
    sqlx::query_as::<_, SessionMeta>(
        r#"
        UPDATE sessions_meta
        SET ended_at = $2, exit_code = $3
        WHERE id = $1 AND ended_at IS NULL
        RETURNING *
        "#,
    )
    .bind(session_id)
    .bind(ended_at)
    .bind(exit_code)
    .fetch_optional(db)
    .await
}

/// Called by the reaper: find sessions whose last heartbeat is older than
/// `threshold_secs` and flip them to ended_at = now(). Returns the ids that
/// were reaped so the caller can emit synthetic grid updates.
pub async fn reap_stale(db: &PgPool, threshold_secs: i64) -> sqlx::Result<Vec<Uuid>> {
    let rows: Vec<(Uuid,)> = sqlx::query_as(
        r#"
        UPDATE sessions_meta
        SET ended_at = now()
        WHERE ended_at IS NULL
          AND last_heartbeat_at < now() - make_interval(secs => $1::double precision)
        RETURNING id
        "#,
    )
    .bind(threshold_secs as f64)
    .fetch_all(db)
    .await?;
    Ok(rows.into_iter().map(|(id,)| id).collect())
}

pub async fn get(db: &PgPool, session_id: Uuid) -> sqlx::Result<Option<SessionMeta>> {
    sqlx::query_as::<_, SessionMeta>("SELECT * FROM sessions_meta WHERE id = $1")
        .bind(session_id)
        .fetch_optional(db)
        .await
}

pub async fn list_active(db: &PgPool) -> sqlx::Result<Vec<SessionMeta>> {
    sqlx::query_as::<_, SessionMeta>(
        "SELECT * FROM sessions_meta WHERE ended_at IS NULL ORDER BY started_at DESC",
    )
    .fetch_all(db)
    .await
}
