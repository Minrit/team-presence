//! Public binary-distribution routes (plan 010).
//!
//! This module owns the three unauthenticated endpoints that let new
//! teammates onboard with a single `curl <server>/install.sh | sh`:
//!
//! - `GET /download/manifest.json` — list of available artifacts + sha256
//! - `GET /download/{artifact}`    — the binary itself (regex-guarded)
//! - `GET /install.sh`             — POSIX shell installer, server URL
//!                                   injected from the request `Host`.
//!
//! None of these go through the auth middleware: the artifacts are
//! compile-outputs of a public repo, and gating them would kill the
//! `curl | sh` UX. See plan 010 "Key Technical Decisions".
//!
//! The router is intentionally generic over its state so tests can mount it
//! with a bare [`DownloadsState`] (tempdir + no db/redis); production wires
//! it onto the shared [`crate::state::AppState`] via [`FromRef`].

use std::{path::PathBuf, sync::Arc};

use axum::{extract::FromRef, routing::get, Router};

pub mod handlers;
pub mod install_script;

use crate::state::AppState;

/// Minimum state the download handlers need: a path to a directory
/// containing `manifest.json` and the `tp-mcp-{os}-{arch}` artifacts.
#[derive(Clone)]
pub struct DownloadsState {
    pub dir: Arc<PathBuf>,
}

impl FromRef<AppState> for DownloadsState {
    fn from_ref(app: &AppState) -> Self {
        DownloadsState {
            dir: app.downloads_dir.clone(),
        }
    }
}

/// Build a `Router` for the three public download routes. Generic over the
/// outer state so tests can plug in `DownloadsState` directly.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    DownloadsState: FromRef<S>,
{
    Router::new()
        .route("/download/:name", get(handlers::download))
        .route("/install.sh", get(handlers::install_sh))
}
