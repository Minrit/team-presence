use serde_json::Value as JsonValue;
use sqlx::PgPool;
use uuid::Uuid;

use super::model::{
    ListActivityQuery, ListStoriesQuery, Priority, RelationKind, Story, StoryActivity,
    StoryRelation, StoryStatus,
};
use crate::error::AppError;

pub const FIELD_MAX_BYTES: usize = 1_000_000;
pub const NAME_MAX_BYTES: usize = 512;
pub const BRANCH_MAX_BYTES: usize = 256;
pub const PR_REF_MAX_BYTES: usize = 512;

#[allow(clippy::too_many_arguments)]
pub async fn create(
    db: &PgPool,
    actor: Uuid,
    name: &str,
    description: &str,
    acceptance_criteria: &JsonValue,
    status: StoryStatus,
    owner_id: Option<Uuid>,
    repo: Option<&str>,
    sprint_id: Option<Uuid>,
    priority: Option<Priority>,
    points: Option<i32>,
    epic_id: Option<Uuid>,
    branch: Option<&str>,
    pr_ref: Option<&str>,
) -> Result<Story, AppError> {
    sqlx::query_as::<_, Story>(
        r#"INSERT INTO stories (
               name, description, acceptance_criteria, status,
               owner_id, repo, sprint_id,
               priority, points, epic_id, branch, pr_ref,
               last_modified_by
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING *"#,
    )
    .bind(name)
    .bind(description)
    .bind(acceptance_criteria)
    .bind(status)
    .bind(owner_id)
    .bind(repo)
    .bind(sprint_id)
    .bind(priority)
    .bind(points)
    .bind(epic_id)
    .bind(branch)
    .bind(pr_ref)
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
             AND ($4::UUID IS NULL OR epic_id = $4)
             AND ($5::TEXT IS NULL OR priority = $5)
           ORDER BY updated_at DESC"#,
    )
    .bind(q.status.map(|s| s.as_str()))
    .bind(q.owner)
    .bind(q.sprint)
    .bind(q.epic)
    .bind(q.priority.map(priority_str))
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
    acceptance_criteria: Option<&JsonValue>,
    status: Option<StoryStatus>,
    owner_id: Option<Option<Uuid>>,
    repo: Option<Option<&str>>,
    sprint_id: Option<Option<Uuid>>,
    priority: Option<Option<Priority>>,
    points: Option<Option<i32>>,
    epic_id: Option<Option<Uuid>>,
    branch: Option<Option<&str>>,
    pr_ref: Option<Option<&str>>,
) -> Result<Option<Story>, AppError> {
    let (owner_set, owner_value) = split_opt(owner_id);
    let (repo_set, repo_value) = split_opt(repo);
    let (sprint_set, sprint_value) = split_opt(sprint_id);
    let (prio_set, prio_value) = split_opt(priority);
    let (pts_set, pts_value) = split_opt(points);
    let (epic_set, epic_value) = split_opt(epic_id);
    let (branch_set, branch_value) = split_opt(branch);
    let (pr_set, pr_value) = split_opt(pr_ref);

    let row: Option<Story> = sqlx::query_as::<_, Story>(
        r#"UPDATE stories SET
              name                = COALESCE($2, name),
              description         = COALESCE($3, description),
              acceptance_criteria = COALESCE($4, acceptance_criteria),
              status              = COALESCE($5, status),
              owner_id            = CASE WHEN $6  THEN $7  ELSE owner_id  END,
              repo                = CASE WHEN $8  THEN $9  ELSE repo      END,
              sprint_id           = CASE WHEN $10 THEN $11 ELSE sprint_id END,
              priority            = CASE WHEN $12 THEN $13 ELSE priority  END,
              points              = CASE WHEN $14 THEN $15 ELSE points    END,
              epic_id             = CASE WHEN $16 THEN $17 ELSE epic_id   END,
              branch              = CASE WHEN $18 THEN $19 ELSE branch    END,
              pr_ref              = CASE WHEN $20 THEN $21 ELSE pr_ref    END,
              last_modified_by    = $22,
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
    .bind(prio_set)
    .bind(prio_value)
    .bind(pts_set)
    .bind(pts_value)
    .bind(epic_set)
    .bind(epic_value)
    .bind(branch_set)
    .bind(branch_value)
    .bind(pr_set)
    .bind(pr_value)
    .bind(actor)
    .fetch_optional(db)
    .await?;

    Ok(row)
}

// --- Activity ---------------------------------------------------------------

pub async fn list_activity(
    db: &PgPool,
    story_id: Uuid,
    q: &ListActivityQuery,
) -> Result<Vec<StoryActivity>, AppError> {
    let limit = q.limit.unwrap_or(50).clamp(1, 500);
    sqlx::query_as::<_, StoryActivity>(
        r#"SELECT * FROM story_activity
           WHERE story_id = $1
           ORDER BY created_at DESC
           LIMIT $2"#,
    )
    .bind(story_id)
    .bind(limit)
    .fetch_all(db)
    .await
    .map_err(Into::into)
}

// --- Relations --------------------------------------------------------------

pub async fn create_relation(
    db: &PgPool,
    from: Uuid,
    to: Uuid,
    kind: RelationKind,
) -> Result<StoryRelation, AppError> {
    if from == to {
        return Err(AppError::BadRequest(
            "story cannot block itself".into(),
        ));
    }

    sqlx::query_as::<_, StoryRelation>(
        r#"INSERT INTO story_relations (from_story_id, to_story_id, kind)
           VALUES ($1, $2, $3)
           RETURNING *"#,
    )
    .bind(from)
    .bind(to)
    .bind(kind)
    .fetch_one(db)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err)
            if db_err.code().as_deref() == Some("23505") =>
        {
            AppError::BadRequest("relation already exists".into())
        }
        sqlx::Error::Database(ref db_err)
            if db_err.code().as_deref() == Some("23503") =>
        {
            AppError::BadRequest("related story not found".into())
        }
        other => other.into(),
    })
}

pub async fn delete_relation(
    db: &PgPool,
    from: Uuid,
    to: Uuid,
    kind: RelationKind,
) -> Result<bool, AppError> {
    let res = sqlx::query(
        r#"DELETE FROM story_relations
           WHERE from_story_id = $1 AND to_story_id = $2 AND kind = $3"#,
    )
    .bind(from)
    .bind(to)
    .bind(kind)
    .execute(db)
    .await?;
    Ok(res.rows_affected() > 0)
}

pub async fn relations_for(
    db: &PgPool,
    story_id: Uuid,
) -> Result<Vec<StoryRelation>, AppError> {
    sqlx::query_as::<_, StoryRelation>(
        r#"SELECT * FROM story_relations
           WHERE from_story_id = $1 OR to_story_id = $1
           ORDER BY created_at ASC"#,
    )
    .bind(story_id)
    .fetch_all(db)
    .await
    .map_err(Into::into)
}

// --- helpers ----------------------------------------------------------------

fn split_opt<T>(v: Option<Option<T>>) -> (bool, Option<T>) {
    match v {
        None => (false, None),
        Some(inner) => (true, inner),
    }
}

fn priority_str(p: Priority) -> &'static str {
    match p {
        Priority::P1 => "P1",
        Priority::P2 => "P2",
        Priority::P3 => "P3",
        Priority::P4 => "P4",
    }
}
