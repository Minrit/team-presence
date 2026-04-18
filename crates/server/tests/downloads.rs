//! Integration tests for `/download/*` and `/install.sh` (plan 010 Unit 2).
//!
//! These tests mount ONLY the downloads router with a substate pointing at a
//! tempdir, so they don't need Postgres or Redis.

use std::{fs, path::PathBuf};

use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
    Router,
};
use team_presence_server::downloads;
use tower::ServiceExt;

fn make_router(dir: PathBuf) -> Router {
    downloads::router().with_state(downloads::DownloadsState {
        dir: std::sync::Arc::new(dir),
    })
}

async fn body_bytes(res: axum::response::Response) -> Vec<u8> {
    to_bytes(res.into_body(), 1 << 20).await.unwrap().to_vec()
}

#[tokio::test]
async fn manifest_ok_when_present() {
    let tmp = tempfile::tempdir().unwrap();
    let manifest = r#"{"version":"0.0.1+gtest","artifacts":[]}"#;
    fs::write(tmp.path().join("manifest.json"), manifest).unwrap();

    let app = make_router(tmp.path().to_path_buf());
    let res = app
        .oneshot(
            Request::builder()
                .uri("/download/manifest.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let ct = res.headers().get("content-type").unwrap().to_str().unwrap();
    assert!(ct.starts_with("application/json"), "got {ct}");
    assert_eq!(body_bytes(res).await, manifest.as_bytes());
}

#[tokio::test]
async fn manifest_404_when_missing() {
    let tmp = tempfile::tempdir().unwrap();
    let app = make_router(tmp.path().to_path_buf());
    let res = app
        .oneshot(
            Request::builder()
                .uri("/download/manifest.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn artifact_returns_bytes_and_length() {
    let tmp = tempfile::tempdir().unwrap();
    // Pretend binary: 42 bytes of deterministic junk.
    let bytes: Vec<u8> = (0u8..42).collect();
    fs::write(tmp.path().join("tp-mcp-darwin-aarch64"), &bytes).unwrap();

    let app = make_router(tmp.path().to_path_buf());
    let res = app
        .oneshot(
            Request::builder()
                .uri("/download/tp-mcp-darwin-aarch64")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(
        res.headers().get("content-type").unwrap(),
        "application/octet-stream"
    );
    assert_eq!(
        res.headers().get("content-length").unwrap(),
        bytes.len().to_string().as_str()
    );
    let cd = res
        .headers()
        .get("content-disposition")
        .unwrap()
        .to_str()
        .unwrap();
    assert!(cd.contains("tp-mcp"), "content-disposition: {cd}");
    assert_eq!(body_bytes(res).await, bytes);
}

#[tokio::test]
async fn artifact_rejects_unknown_name() {
    // Even if the file exists under an unexpected name, the regex guard
    // must refuse to serve it. (defense against directory traversal +
    // accidental exposure of unrelated files.)
    let tmp = tempfile::tempdir().unwrap();
    fs::write(tmp.path().join("tp-mcp-foo-bar"), b"junk").unwrap();

    let app = make_router(tmp.path().to_path_buf());
    let res = app
        .oneshot(
            Request::builder()
                .uri("/download/tp-mcp-foo-bar")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn artifact_404_when_file_missing() {
    let tmp = tempfile::tempdir().unwrap();
    let app = make_router(tmp.path().to_path_buf());
    let res = app
        .oneshot(
            Request::builder()
                .uri("/download/tp-mcp-linux-x86_64")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn install_sh_injects_server_base_from_host() {
    let tmp = tempfile::tempdir().unwrap();
    let app = make_router(tmp.path().to_path_buf());
    let res = app
        .oneshot(
            Request::builder()
                .uri("/install.sh")
                .header("host", "tp.example.com:8080")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let ct = res
        .headers()
        .get("content-type")
        .unwrap()
        .to_str()
        .unwrap();
    assert!(
        ct.starts_with("text/x-shellscript") || ct.starts_with("text/plain"),
        "content-type was {ct}"
    );
    let body = String::from_utf8(body_bytes(res).await).unwrap();
    assert!(body.starts_with("#!/bin/sh"), "missing shebang:\n{body}");
    assert!(
        body.contains("http://tp.example.com:8080"),
        "expected server URL injected, got:\n{body}"
    );
}

#[tokio::test]
async fn install_sh_respects_x_forwarded_proto() {
    let tmp = tempfile::tempdir().unwrap();
    let app = make_router(tmp.path().to_path_buf());
    let res = app
        .oneshot(
            Request::builder()
                .uri("/install.sh")
                .header("host", "tp.example.com")
                .header("x-forwarded-proto", "https")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = String::from_utf8(body_bytes(res).await).unwrap();
    assert!(
        body.contains("https://tp.example.com"),
        "expected https URL, got:\n{body}"
    );
    assert!(!body.contains("http://tp.example.com\n"), "leaked http scheme");
}
