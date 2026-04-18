//! `tp-mcp` — the team-presence MCP server.
//!
//! Stdio JSON-RPC adapter that exposes project-management + collector
//! operations as MCP tools. The browser UI is now read-only; all writes
//! flow through this process and land on the Axum HTTP server via the
//! regular `/api/v1/*` surface. The `X-Actor-Kind: agent` request header
//! maps each write into `story_activity.actor_type='agent'` so audit
//! records cleanly distinguish human vs agent operations.

pub mod api;
pub mod error;
pub mod server;
