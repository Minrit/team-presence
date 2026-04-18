use sqlx::PgPool;
use uuid::Uuid;

use super::model::{ListStoriesQuery, Story, StoryStatus};
use crate::error::AppError;

/// Default story content length cap (1 MB). Configurable via env but hard-coded for MVP.
pub const DESCRIPTION_MAX_BYTES: usize = 1_000_000;
pub const TITLE_MAX_BYTES: usize = 512;

pub async fn create(
    db: &PgPool,
    actor: Uuid,
    title: &str,
    description: &str,
    status: StoryStatus,
    owner_id: Option<Uuid>,
    repo: Option<&str>,
) -> Result<Story, AppError> {
    sqlx::query_as::<_, Story>(
        r#"INSERT INTO stories (title, description, status, owner_id, repo, last_modified_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *"#,
    )
    .bind(title)
    .bind(description)
    .bind(status)
    .bind(owner_id)
    .bind(repo)
    .bind(actor)
    .fetch_one(db)
    .await
    .map_err(Into::into)
}

pub async fn get(db: &PgPool, id: Uuid) -> Result<Option<Story>, AppError> {
    sqlx::query_as::<_, Story>("SELECT * FROM stories WHERE id = $1")
        .bind(id)
        .fetch_optional(db)
        .await
        .map_err(Into::into)
}

pub async fn list(db: &PgPool, q: &ListStoriesQuery) -> Result<Vec<Story>, AppError> {
    // Simple optional filters — small N (6 users, dozens of stories). No pagination yet.
    let rows = sqlx::query_as::<_, Story>(
        r#"SELECT * FROM stories
           WHERE ($1::TEXT IS NULL OR status = $1)
             AND ($2::UUID IS NULL OR owner_id = $2)
           ORDER BY updated_at DESC"#,
    )
    .bind(q.status.map(status_str))
    .bind(q.owner)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn delete(db: &PgPool, id: Uuid) -> Result<bool, AppError> {
    let res = sqlx::query("DELETE FROM stories WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(res.rows_affected() > 0)
}

#[allow(clippy::too_many_arguments)]
pub async fn patch(
    db: &PgPool,
    id: Uuid,
    actor: Uuid,
    title: Option<&str>,
    description: Option<&str>,
    status: Option<StoryStatus>,
    owner_id: Option<Option<Uuid>>,
    repo: Option<Option<&str>>,
) -> Result<Option<Story>, AppError> {
    // COALESCE trick: `$n::... IS NULL` means "no change" on the DB side for each field.
    // For the tri-state fields (owner_id, repo) we add a separate sentinel param so
    // callers can distinguish "leave alone" from "set to NULL".
    let owner_set = owner_id.is_some();
    let owner_value = owner_id.flatten();
    let repo_set = repo.is_some();
    let repo_value = repo.flatten();

    let row: Option<Story> = sqlx::query_as::<_, Story>(
        r#"UPDATE stories SET
              title            = COALESCE($2, title),
              description      = COALESCE($3, description),
              status           = COALESCE($4, status),
              owner_id         = CASE WHEN $5 THEN $6 ELSE owner_id END,
              repo             = CASE WHEN $7 THEN $8 ELSE repo END,
              last_modified_by = $9,
              updated_at       = now()
           WHERE id = $1
           RETURNING *"#,
    )
    .bind(id)
    .bind(title)
    .bind(description)
    .bind(status)
    .bind(owner_set)
    .bind(owner_value)
    .bind(repo_set)
    .bind(repo_value)
    .bind(actor)
    .fetch_optional(db)
    .await?;

    Ok(row)
}

/// Used by the task module to bump the parent story's audit fields in the same
/// transaction as any task mutation.
pub async fn bump_parent<'e, E>(conn: E, story_id: Uuid, actor: Uuid) -> Result<(), AppError>
where
    E: sqlx::PgExecutor<'e>,
{
    sqlx::query(
        "UPDATE stories SET last_modified_by = $1, updated_at = now() WHERE id = $2",
    )
    .bind(actor)
    .bind(story_id)
    .execute(conn)
    .await?;
    Ok(())
}

fn status_str(s: StoryStatus) -> &'static str {
    match s {
        StoryStatus::Todo => "todo",
        StoryStatus::Doing => "doing",
        StoryStatus::Done => "done",
    }
}
