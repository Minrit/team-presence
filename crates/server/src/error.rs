use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("unauthorized")]
    Unauthorized,
    #[error("not found")]
    NotFound,
    #[error("email already registered")]
    Conflict,
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("bootstrap already done — use POST /api/v1/auth/users to add more members")]
    BootstrapAlreadyDone,
    #[error("db error")]
    Db(#[from] sqlx::Error),
    #[error("internal: {0}")]
    Internal(#[from] anyhow::Error),
}

#[derive(Serialize)]
struct Body {
    code: &'static str,
    message: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code) = match &self {
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized"),
            AppError::NotFound => (StatusCode::NOT_FOUND, "not_found"),
            AppError::Conflict => (StatusCode::CONFLICT, "conflict"),
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, "bad_request"),
            AppError::BootstrapAlreadyDone => (StatusCode::FORBIDDEN, "bootstrap_done"),
            AppError::Db(_) | AppError::Internal(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "internal")
            }
        };
        tracing::warn!(
            error = %self,
            status = status.as_u16(),
            phase = "error_response",
            component = "server",
        );
        (
            status,
            Json(Body {
                code,
                message: self.to_string(),
            }),
        )
            .into_response()
    }
}
