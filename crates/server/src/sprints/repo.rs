use chrono::NaiveDate;
use sqlx::PgPool;
use uuid::Uuid;

use super::model::Sprint;
use crate::error::AppError;

pub const NAME_MAX_BYTES: usize = 256;

pub async fn create(
    db: &PgPool,
    name: &str,
    start: NaiveDate,
    end: NaiveDate,
) -> Result<Sprint, AppError> {
    sqlx::query_as::<_, Sprint>(
        r#"INSERT INTO sprints (name, start_date, end_date)
           VALUES ($1, $2, $3)
           RETURNING *"#,
    )
    .bind(name)
    .bind(start)
    .bind(end)
    .fetch_one(db)
    .await
    .map_err(Into::into)
}

pub async fn list(db: &PgPool) -> Result<Vec<Sprint>, AppError> {
    sqlx::query_as::<_, Sprint>("SELECT * FROM sprints ORDER BY start_date DESC")
        .fetch_all(db)
        .await
        .map_err(Into::into)
}

pub async fn get(db: &PgPool, id: Uuid) -> Result<Option<Sprint>, AppError> {
    sqlx::query_as::<_, Sprint>("SELECT * FROM sprints WHERE id = $1")
        .bind(id)
        .fetch_optional(db)
        .await
        .map_err(Into::into)
}

pub async fn patch(
    db: &PgPool,
    id: Uuid,
    name: Option<&str>,
    start: Option<NaiveDate>,
    end: Option<NaiveDate>,
) -> Result<Option<Sprint>, AppError> {
    sqlx::query_as::<_, Sprint>(
        r#"UPDATE sprints SET
              name       = COALESCE($2, name),
              start_date = COALESCE($3, start_date),
              end_date   = COALESCE($4, end_date),
              updated_at = now()
           WHERE id = $1
           RETURNING *"#,
    )
    .bind(id)
    .bind(name)
    .bind(start)
    .bind(end)
    .fetch_optional(db)
    .await
    .map_err(Into::into)
}

pub async fn delete(db: &PgPool, id: Uuid) -> Result<bool, AppError> {
    let res = sqlx::query("DELETE FROM sprints WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(res.rows_affected() > 0)
}
