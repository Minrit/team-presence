pub mod auth;
pub mod collectors;
pub mod error;
pub mod state;
pub mod stories;
pub mod tasks;
pub mod telemetry;

use axum::{
    middleware,
    routing::{delete, get, patch, post},
    Router,
};
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
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_identity,
        ));

    let public = Router::new()
        .route("/health", get(health))
        .route("/api/v1/auth/bootstrap", post(auth::handlers::bootstrap))
        .route("/api/v1/auth/login", post(auth::handlers::login))
        .route("/api/v1/auth/refresh", post(auth::handlers::refresh))
        .route("/api/v1/auth/logout", post(auth::handlers::logout));

    public.merge(protected).with_state(state)
}

async fn health() -> &'static str {
    "ok"
}
