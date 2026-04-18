//! team-presence collector — laptop-side agent.
//!
//! Shipped in slices (plan Unit 6):
//!   Phase A  — CLI + credentials + login/status/mute/install-hooks
//!   Phase B  — hook socket listener + claude-code transcript tail
//!   Phase C  — WS client + heartbeat loop + reconnect
//!
//! Unit 7 (server WS endpoint) is not yet live, so Phase C's `start` fails
//! fast against a missing server — the failure message points at that.

pub mod capture;
pub mod cli;
pub mod client;
pub mod config;
pub mod consent;
pub mod credentials;
pub mod hooks;
pub mod mute;
pub mod start;
pub mod telemetry;

#[cfg(test)]
pub mod test_support;
