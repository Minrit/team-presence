//! HTTP handlers for `/download/*` and `/install.sh`.

use std::fs;

use axum::{
    body::Body,
    extract::{Path as AxPath, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use once_cell::sync::Lazy;
use regex::Regex;

use super::{install_script, DownloadsState};

/// Accept only our own release-artifact naming pattern. This also blocks
/// any attempt at directory traversal (`..`), since `:name` in axum is a
/// single path segment but we double down with an explicit regex anchor.
static ARTIFACT_NAME: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^tp-mcp-(?:darwin|linux)-(?:aarch64|x86_64)$").unwrap());

const ERR_JSON_CT: (header::HeaderName, &str) =
    (header::CONTENT_TYPE, "application/json");

fn not_found(message: &str) -> Response {
    let body = format!(r#"{{"code":"not_found","message":"{message}"}}"#);
    (StatusCode::NOT_FOUND, [ERR_JSON_CT], body).into_response()
}

/// `GET /download/:name`
///
/// Two valid names:
///   - `manifest.json`            → serves the manifest file
///   - `tp-mcp-{os}-{arch}`       → serves the matching binary artifact
///
/// Anything else → 404 (we don't want this route to act as a general file
/// browser for the downloads directory).
pub async fn download(
    State(state): State<DownloadsState>,
    AxPath(name): AxPath<String>,
) -> Response {
    if name == "manifest.json" {
        return serve_manifest(&state);
    }

    if !ARTIFACT_NAME.is_match(&name) {
        return not_found("no such artifact");
    }

    let path = state.dir.join(&name);
    match fs::read(&path) {
        Ok(bytes) => {
            let len = bytes.len();
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/octet-stream")
                .header(header::CONTENT_LENGTH, len)
                .header(
                    header::CONTENT_DISPOSITION,
                    r#"attachment; filename="tp-mcp""#,
                )
                .body(Body::from(bytes))
                .unwrap()
        }
        Err(_) => not_found("artifact missing"),
    }
}

fn serve_manifest(state: &DownloadsState) -> Response {
    let path = state.dir.join("manifest.json");
    match fs::read(&path) {
        Ok(bytes) => {
            let len = bytes.len();
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/json; charset=utf-8")
                .header(header::CONTENT_LENGTH, len)
                .body(Body::from(bytes))
                .unwrap()
        }
        Err(_) => not_found("manifest not available"),
    }
}

/// `GET /install.sh`
///
/// Returns a POSIX shell script with the server's base URL pre-injected.
/// Scheme is picked up from the `X-Forwarded-Proto` header (so reverse
/// proxies can force `https`); otherwise it falls back to `http`.
pub async fn install_sh(headers: HeaderMap) -> Response {
    let host = headers
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("localhost:8080");
    let scheme = headers
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("http");
    let base = format!("{scheme}://{host}");
    let body = install_script::render(&base);
    Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_TYPE,
            "text/x-shellscript; charset=utf-8",
        )
        .body(Body::from(body))
        .unwrap()
}
