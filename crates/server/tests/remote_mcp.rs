use std::{path::PathBuf, sync::Arc};

use axum::{
    body::{to_bytes, Body},
    http::{header, Request, StatusCode},
};
use redis::Client as RedisClient;
use sqlx::postgres::PgPoolOptions;
use team_presence_server::{
    auth::jwt,
    build_router,
    state::{AppState, JwtConfig},
};
use tower::ServiceExt;
use uuid::Uuid;

fn test_state() -> AppState {
    AppState {
        db: PgPoolOptions::new()
            .connect_lazy("postgres://team_presence:test@127.0.0.1/team_presence_test")
            .unwrap(),
        redis: RedisClient::open("redis://127.0.0.1:6379").unwrap(),
        jwt: Arc::new(JwtConfig {
            secret: "test-secret".into(),
            access_ttl_secs: 60,
            refresh_ttl_secs: 60,
        }),
        downloads_dir: Arc::new(PathBuf::from("./downloads")),
    }
}

async fn body_json(res: axum::response::Response) -> serde_json::Value {
    let bytes = to_bytes(res.into_body(), 1 << 20).await.unwrap();
    serde_json::from_slice(&bytes).unwrap()
}

fn mcp_request(body: &'static str, token: Option<&str>) -> Request<Body> {
    mcp_request_with_host(body, token, "localhost")
}

fn mcp_request_with_host(
    body: &'static str,
    token: Option<&str>,
    host: &'static str,
) -> Request<Body> {
    let mut builder = Request::builder()
        .method("POST")
        .uri("/mcp")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCEPT, "application/json, text/event-stream")
        .header(header::HOST, host);
    if let Some(token) = token {
        builder = builder.header(header::AUTHORIZATION, format!("Bearer {token}"));
    }
    builder.body(Body::from(body)).unwrap()
}

#[tokio::test]
async fn mcp_requires_bearer_auth() {
    let app = build_router(test_state());
    let res = app
        .oneshot(mcp_request(
            r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}"#,
            None,
        ))
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn mcp_exposes_remote_pm_tools_not_local_collector_tools() {
    let state = test_state();
    let token = jwt::encode_access(&state.jwt.secret, Uuid::new_v4(), 60).unwrap();
    let app = build_router(state);

    let init = app
        .clone()
        .oneshot(mcp_request(
            r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}"#,
            Some(&token),
        ))
        .await
        .unwrap();
    assert_eq!(init.status(), StatusCode::OK);
    let init_json = body_json(init).await;
    assert_eq!(init_json["result"]["serverInfo"]["name"], "team-presence");

    let tools = app
        .oneshot(mcp_request(
            r#"{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}"#,
            Some(&token),
        ))
        .await
        .unwrap();
    assert_eq!(tools.status(), StatusCode::OK);
    let json = body_json(tools).await;
    let names = json["result"]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|tool| tool["name"].as_str())
        .collect::<Vec<_>>();

    assert!(names.contains(&"tp_story_create"));
    assert!(names.contains(&"tp_story_list"));
    assert!(names.contains(&"tp_story_edit"));
    assert!(names.contains(&"tp_ac_add"));
    assert!(names.contains(&"tp_comment_create"));
    assert!(names.contains(&"tp_relation_block"));
    assert!(names.contains(&"tp_activity_list"));
    assert!(names.contains(&"tp_sprint_create"));
    assert!(names.contains(&"tp_epic_create"));
    assert!(!names.contains(&"tp_collector_status"));
    assert!(!names.contains(&"tp_collector_install_hooks"));
}

#[tokio::test]
async fn mcp_accepts_hosted_service_hostnames_by_default() {
    let state = test_state();
    let token = jwt::encode_access(&state.jwt.secret, Uuid::new_v4(), 60).unwrap();
    let app = build_router(state);

    let init = app
        .oneshot(mcp_request_with_host(
            r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}"#,
            Some(&token),
            "team-presence.example.com",
        ))
        .await
        .unwrap();

    assert_eq!(init.status(), StatusCode::OK);
}
