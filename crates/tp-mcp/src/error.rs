//! Error flavors for the MCP bridge. Converted to rmcp's error type at the
//! tool boundary so the agent receives a clear message + category instead of
//! a raw `reqwest` / `anyhow` stack.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum McpError {
    #[error("not logged in — run `team-presence login --server <url> --email <you>`")]
    NotLoggedIn,
    #[error("backend request failed: {0}")]
    Http(#[from] reqwest::Error),
    #[error("backend returned {status}: {body}")]
    Status { status: u16, body: String },
    #[error("json decode: {0}")]
    Json(#[from] serde_json::Error),
    #[error("credentials: {0}")]
    Credentials(String),
    #[error("bad input: {0}")]
    BadInput(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("{0}")]
    Other(String),
}

impl From<McpError> for rmcp::ErrorData {
    fn from(e: McpError) -> Self {
        let msg = e.to_string();
        match e {
            McpError::NotLoggedIn => rmcp::ErrorData::invalid_request(msg, None),
            McpError::BadInput(_) => rmcp::ErrorData::invalid_params(msg, None),
            McpError::NotFound(_) => rmcp::ErrorData::invalid_request(msg, None),
            _ => rmcp::ErrorData::internal_error(msg, None),
        }
    }
}

pub type McpResult<T> = Result<T, McpError>;
