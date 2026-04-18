pub mod auth;
pub mod collectors;
pub mod error;
pub mod session;
pub mod sse;
pub mod state;
pub mod stories;
pub mod tasks;
pub mod telemetry;
pub mod ws;

use axum::{
    middleware,
    routing::{delete, get, patch, post},
    Router,
};
use session::handlers as sessions;
use state::AppState;

pub fn build_router(state: AppState) -> Router {
    let protected = Router::new()
        .route("/api/v1/auth/me", get(auth::handlers::me))
        .route("/api/v1/auth/users", post(auth::handlers::add_user_authenticated))
        .route("/api/v1/collectors", post(collectors::mint))
        .route("/api/v1/collectors/:id", delete(collectors::revoke))
        // Stories CRUD
        .route(
            "/api/v1/stories",
            post(stories::handlers::create).get(stories::handlers::list),
        )
        .route(
            "/api/v1/stories/:id",
            get(stories::handlers::get_one)
                .patch(stories::handlers::patch)
                .delete(stories::handlers::delete),
        )
        // Tasks CRUD (nested under story for create, flat for patch/delete)
        .route("/api/v1/stories/:id/tasks", post(tasks::handlers::create))
        .route(
            "/api/v1/tasks/:id",
            patch(tasks::handlers::patch).delete(tasks::handlers::delete),
        )
        // Sessions metadata (for 改派 reassign and list-active)
        .route("/api/v1/sessions", get(sessions::list_active))
        .route("/api/v1/sessions/:id", patch(sessions::reassign))
        // Viewer SSE (browser JWT Bearer)
        .route("/sse/room/:session_id", get(sse::room::handler))
        .route("/sse/grid", get(sse::grid::handler))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_identity,
        ));

    // Collector WS does its own bearer check because axum middleware can't
    // run on the upgraded socket (we need the collector_token_id, not just
    // user_id, on the session's persistence path).
    let collector_ws = Router::new().route("/ws/collector", get(ws::collector::ws_handler));

    let public = Router::new()
        .route("/health", get(health))
        .route("/api/v1/auth/bootstrap", post(auth::handlers::bootstrap))
        .route("/api/v1/auth/login", post(auth::handlers::login))
        .route("/api/v1/auth/refresh", post(auth::handlers::refresh))
        .route("/api/v1/auth/logout", post(auth::handlers::logout));

    public
        .merge(protected)
        .merge(collector_ws)
        .with_state(state)
}

async fn health() -> &'static str {
    "ok"
}
