use sqlx::PgPool;
use uuid::Uuid;

use super::model::{ListStoriesQuery, Story, StoryStatus};
use crate::error::AppError;

/// Default story content length caps. Shared by description and acceptance_criteria.
pub const FIELD_MAX_BYTES: usize = 1_000_000;
pub const NAME_MAX_BYTES: usize = 512;

#[allow(clippy::too_many_arguments)]
pub async fn create(
    db: &PgPool,
    actor: Uuid,
    name: &str,
    description: &str,
    acceptance_criteria: &str,
    status: StoryStatus,
    owner_id: Option<Uuid>,
    repo: Option<&str>,
    sprint_id: Option<Uuid>,
) -> Result<Story, AppError> {
    sqlx::query_as::<_, Story>(
        r#"INSERT INTO stories (
               name, description, acceptance_criteria, status,
               owner_id, repo, sprint_id, last_modified_by
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *"#,
    )
    .bind(name)
    .bind(description)
    .bind(acceptance_criteria)
    .bind(status)
    .bind(owner_id)
    .bind(repo)
    .bind(sprint_id)
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
    sqlx::query_as::<_, Story>(
        r#"SELECT * FROM stories
           WHERE ($1::TEXT IS NULL OR status = $1)
             AND ($2::UUID IS NULL OR owner_id = $2)
             AND ($3::UUID IS NULL OR sprint_id = $3)
           ORDER BY updated_at DESC"#,
    )
    .bind(q.status.map(status_str))
    .bind(q.owner)
    .bind(q.sprint)
    .fetch_all(db)
    .await
    .map_err(Into::into)
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
    name: Option<&str>,
    description: Option<&str>,
    acceptance_criteria: Option<&str>,
    status: Option<StoryStatus>,
    owner_id: Option<Option<Uuid>>,
    repo: Option<Option<&str>>,
    sprint_id: Option<Option<Uuid>>,
) -> Result<Option<Story>, AppError> {
    let owner_set = owner_id.is_some();
    let owner_value = owner_id.flatten();
    let repo_set = repo.is_some();
    let repo_value = repo.flatten();
    let sprint_set = sprint_id.is_some();
    let sprint_value = sprint_id.flatten();

    let row: Option<Story> = sqlx::query_as::<_, Story>(
        r#"UPDATE stories SET
              name                = COALESCE($2, name),
              description         = COALESCE($3, description),
              acceptance_criteria = COALESCE($4, acceptance_criteria),
              status              = COALESCE($5, status),
              owner_id            = CASE WHEN $6 THEN $7 ELSE owner_id END,
              repo                = CASE WHEN $8 THEN $9 ELSE repo END,
              sprint_id           = CASE WHEN $10 THEN $11 ELSE sprint_id END,
              last_modified_by    = $12,
              updated_at          = now()
           WHERE id = $1
           RETURNING *"#,
    )
    .bind(id)
    .bind(name)
    .bind(description)
    .bind(acceptance_criteria)
    .bind(status)
    .bind(owner_set)
    .bind(owner_value)
    .bind(repo_set)
    .bind(repo_value)
    .bind(sprint_set)
    .bind(sprint_value)
    .bind(actor)
    .fetch_optional(db)
    .await?;

    Ok(row)
}

fn status_str(s: StoryStatus) -> &'static str {
    match s {
        StoryStatus::Todo => "todo",
        StoryStatus::Doing => "doing",
        StoryStatus::Done => "done",
    }
}
