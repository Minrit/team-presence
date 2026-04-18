use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::model::Task;
use crate::{error::AppError, stories::repo as story_repo};

pub const TITLE_MAX_BYTES: usize = 512;

pub async fn list_by_story(db: &PgPool, story_id: Uuid) -> Result<Vec<Task>, AppError> {
    sqlx::query_as::<_, Task>(
        "SELECT * FROM tasks WHERE story_id = $1 ORDER BY position ASC, created_at ASC",
    )
    .bind(story_id)
    .fetch_all(db)
    .await
    .map_err(Into::into)
}

pub async fn create(
    db: &PgPool,
    actor: Uuid,
    story_id: Uuid,
    title: &str,
    position: Option<i32>,
) -> Result<Task, AppError> {
    let mut tx: Transaction<'_, Postgres> = db.begin().await?;

    let parent_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM stories WHERE id = $1)")
            .bind(story_id)
            .fetch_one(&mut *tx)
            .await?;
    if !parent_exists {
        return Err(AppError::NotFound);
    }

    let pos = match position {
        Some(p) => p,
        None => {
            let (max,): (Option<i32>,) =
                sqlx::query_as("SELECT MAX(position) FROM tasks WHERE story_id = $1")
                    .bind(story_id)
                    .fetch_one(&mut *tx)
                    .await?;
            max.unwrap_or(-1) + 1
        }
    };

    let task: Task = sqlx::query_as(
        r#"INSERT INTO tasks (story_id, title, position)
           VALUES ($1, $2, $3)
           RETURNING *"#,
    )
    .bind(story_id)
    .bind(title)
    .bind(pos)
    .fetch_one(&mut *tx)
    .await?;

    story_repo::bump_parent(&mut *tx, story_id, actor).await?;
    tx.commit().await?;
    Ok(task)
}

pub async fn patch(
    db: &PgPool,
    actor: Uuid,
    id: Uuid,
    title: Option<&str>,
    done: Option<bool>,
    position: Option<i32>,
) -> Result<Option<Task>, AppError> {
    let mut tx: Transaction<'_, Postgres> = db.begin().await?;

    let row: Option<(Uuid,)> = sqlx::query_as("SELECT story_id FROM tasks WHERE id = $1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?;
    let Some((story_id,)) = row else {
        return Ok(None);
    };

    let done_set = done.is_some();
    let done_value = done.unwrap_or(false);

    let task: Task = sqlx::query_as(
        r#"UPDATE tasks SET
              title      = COALESCE($2, title),
              position   = COALESCE($3, position),
              done_at    = CASE
                              WHEN $4 THEN (CASE WHEN $5 THEN now() ELSE NULL END)
                              ELSE done_at
                           END,
              updated_at = now()
           WHERE id = $1
           RETURNING *"#,
    )
    .bind(id)
    .bind(title)
    .bind(position)
    .bind(done_set)
    .bind(done_value)
    .fetch_one(&mut *tx)
    .await?;

    story_repo::bump_parent(&mut *tx, story_id, actor).await?;
    tx.commit().await?;
    Ok(Some(task))
}

pub async fn delete(db: &PgPool, actor: Uuid, id: Uuid) -> Result<bool, AppError> {
    let mut tx: Transaction<'_, Postgres> = db.begin().await?;

    let row: Option<(Uuid,)> = sqlx::query_as("SELECT story_id FROM tasks WHERE id = $1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?;
    let Some((story_id,)) = row else {
        return Ok(false);
    };

    sqlx::query("DELETE FROM tasks WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    story_repo::bump_parent(&mut *tx, story_id, actor).await?;
    tx.commit().await?;
    Ok(true)
}
