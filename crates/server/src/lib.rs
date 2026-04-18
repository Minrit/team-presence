pub mod auth;
pub mod collectors;
pub mod error;
pub mod state;
pub mod telemetry;

use axum::{
    middleware,
    routing::{delete, get, post},
    Router,
};
use state::AppState;

pub fn build_router(state: AppState) -> Router {
    let protected = Router::new()
        .route("/api/v1/auth/me", get(auth::handlers::me))
        .route("/api/v1/collectors", post(collectors::mint))
        .route("/api/v1/collectors/:id", delete(collectors::revoke))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_identity,
        ));

    let public = Router::new()
        .route("/health", get(health))
        .route("/api/v1/auth/bootstrap", post(auth::handlers::bootstrap))
        .route("/api/v1/auth/login", post(auth::handlers::login))
        .route("/api/v1/auth/refresh", post(auth::handlers::refresh))
        .route("/api/v1/auth/logout", post(auth::handlers::logout))
        // add_user requires auth (closed registration), handled in protected wrapper below
        ;

    let protected_with_add_user = protected.route(
        "/api/v1/auth/users",
        post(auth::handlers::add_user_authenticated),
    );

    public.merge(protected_with_add_user).with_state(state)
}

async fn health() -> &'static str {
    "ok"
}
