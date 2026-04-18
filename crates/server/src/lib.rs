pub mod auth;
pub mod collectors;
pub mod comments;
pub mod downloads;
pub mod epics;
pub mod error;
pub mod session;
pub mod sprints;
pub mod sse;
pub mod state;
pub mod stories;
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
        .route(
            "/api/v1/auth/users",
            get(auth::handlers::list_users).post(auth::handlers::add_user_authenticated),
        )
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
        // Story activity log (Unit 10)
        .route(
            "/api/v1/stories/:id/activity",
            get(stories::handlers::list_activity),
        )
        // Story relations (Unit 10)
        .route(
            "/api/v1/stories/:id/relations",
            get(stories::handlers::list_relations)
                .post(stories::handlers::create_relation),
        )
        .route(
            "/api/v1/stories/:id/relations/:target",
            delete(stories::handlers::delete_relation),
        )
        // Epics CRUD (Unit 10)
        .route(
            "/api/v1/epics",
            get(epics::handlers::list).post(epics::handlers::create),
        )
        .route(
            "/api/v1/epics/:id",
            patch(epics::handlers::patch).delete(epics::handlers::delete),
        )
        // Sprints CRUD
        .route(
            "/api/v1/sprints",
            post(sprints::handlers::create).get(sprints::handlers::list),
        )
        .route(
            "/api/v1/sprints/:id",
            get(sprints::handlers::get_one)
                .patch(sprints::handlers::patch)
                .delete(sprints::handlers::delete),
        )
        // Sessions metadata (for 改派 reassign and list-active)
        .route("/api/v1/sessions", get(sessions::list_active))
        .route("/api/v1/sessions/:id", patch(sessions::reassign))
        // Comments (Unit 11)
        .route(
            "/api/v1/stories/:id/comments",
            get(comments::handlers::list).post(comments::handlers::create),
        )
        // Viewer SSE (browser JWT Bearer)
        .route("/sse/room/:session_id", get(sse::room::handler))
        .route("/sse/grid", get(sse::grid::handler))
        .route("/sse/story/:id/activity", get(sse::activity::handler))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_identity,
        ));

    let collector_ws = Router::new().route("/ws/collector", get(ws::collector::ws_handler));

    let public = Router::new()
        .route("/health", get(health))
        .route("/api/v1/auth/bootstrap", post(auth::handlers::bootstrap))
        .route("/api/v1/auth/login", post(auth::handlers::login))
        .route("/api/v1/auth/refresh", post(auth::handlers::refresh))
        .route("/api/v1/auth/logout", post(auth::handlers::logout));

    // Unauthenticated binary distribution endpoints — intentionally
    // merged OUTSIDE `protected` so `curl | sh` works. See plan 010.
    let downloads = downloads::router::<AppState>();

    public
        .merge(protected)
        .merge(collector_ws)
        .merge(downloads)
        .with_state(state)
}

async fn health() -> &'static str {
    "ok"
}
