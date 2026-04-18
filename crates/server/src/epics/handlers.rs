use axum::{
    extract::{Path, State},
    Extension, Json,
};
use uuid::Uuid;

use super::model::{CreateEpicRequest, Epic, PatchEpicRequest};
use crate::{auth::model::Identity, error::AppError, state::AppState};

const NAME_MAX: usize = 200;
const DESC_MAX: usize = 2000;

pub async fn list(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
) -> Result<Json<Vec<Epic>>, AppError> {
    let rows: Vec<Epic> =
        sqlx::query_as::<_, Epic>("SELECT * FROM epics ORDER BY name ASC")
            .fetch_all(&state.db)
            .await?;
    Ok(Json(rows))
}

pub async fn create(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
    Json(req): Json<CreateEpicRequest>,
) -> Result<Json<Epic>, AppError> {
    let name = req.name.trim().to_string();
    if name.is_empty() || name.len() > NAME_MAX {
        return Err(AppError::BadRequest("name required".into()));
    }
    let color = req.color.unwrap_or_else(|| "#64748b".into());
    validate_color(&color)?;
    let desc = req.description.unwrap_or_default();
    if desc.len() > DESC_MAX {
        return Err(AppError::BadRequest("description too long".into()));
    }

    let row: Epic = sqlx::query_as::<_, Epic>(
        r#"INSERT INTO epics (name, color, description)
           VALUES ($1, $2, $3)
           RETURNING *"#,
    )
    .bind(&name)
    .bind(&color)
    .bind(&desc)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

pub async fn patch(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
    Path(id): Path<Uuid>,
    Json(req): Json<PatchEpicRequest>,
) -> Result<Json<Epic>, AppError> {
    if let Some(n) = &req.name {
        let t = n.trim();
        if t.is_empty() || t.len() > NAME_MAX {
            return Err(AppError::BadRequest("name invalid".into()));
        }
    }
    if let Some(c) = &req.color {
        validate_color(c)?;
    }
    if let Some(d) = &req.description {
        if d.len() > DESC_MAX {
            return Err(AppError::BadRequest("description too long".into()));
        }
    }

    let row: Option<Epic> = sqlx::query_as::<_, Epic>(
        r#"UPDATE epics SET
              name        = COALESCE($2, name),
              color       = COALESCE($3, color),
              description = COALESCE($4, description)
           WHERE id = $1
           RETURNING *"#,
    )
    .bind(id)
    .bind(req.name.as_deref().map(str::trim))
    .bind(req.color.as_deref())
    .bind(req.description.as_deref())
    .fetch_optional(&state.db)
    .await?;
    row.map(Json).ok_or(AppError::NotFound)
}

pub async fn delete(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    let res = sqlx::query("DELETE FROM epics WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

fn validate_color(c: &str) -> Result<(), AppError> {
    // Accept `#RRGGBB` only to keep the token surface small.
    let bytes = c.as_bytes();
    let ok = bytes.len() == 7
        && bytes[0] == b'#'
        && bytes[1..].iter().all(|b| b.is_ascii_hexdigit());
    if !ok {
        return Err(AppError::BadRequest(
            "color must be #RRGGBB hex".into(),
        ));
    }
    Ok(())
}
