//! `team-presence start` runtime — wires hook socket → transcript tailers →
//! mute gate → (WS pump + offline log sink) + heartbeat emitter.
//!
//! TP_OFFLINE=1 skips the WS pump — useful for dogfood before Unit 7 ships.

use std::path::PathBuf;

use chrono::Utc;
use team_presence_shared_types::{AgentKind, Frame};
use tokio::sync::mpsc;

use crate::capture::{hook_socket, session_uuid, transcript::Tailer, HookEvent};
use crate::config;
use crate::credentials::Credentials;
use crate::heartbeat::{self, ActiveSessions};
use crate::mute;
use crate::ws_client;

const FRAME_CHANNEL_CAPACITY: usize = 8192;

pub async fn run(creds: Credentials, agent_kind: AgentKind) -> anyhow::Result<()> {
    let socket_path = config::hook_socket_path();
    let listener = hook_socket::bind(&socket_path)?;
    let (hook_tx, mut hook_rx) = mpsc::channel::<HookEvent>(64);
    let (frame_tx, frame_rx) = mpsc::channel::<Frame>(FRAME_CHANNEL_CAPACITY);

    let _hook_loop = tokio::spawn(hook_socket::run(listener, hook_tx));

    let sessions = ActiveSessions::default();

    // Heartbeat task: emits Frame::Heartbeat into the main channel at 30s cadence.
    let hb_sessions = sessions.clone();
    let hb_tx = frame_tx.clone();
    tokio::spawn(heartbeat::run(hb_sessions, hb_tx, mute::is_muted));

    let offline = std::env::var("TP_OFFLINE")
        .ok()
        .as_deref()
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    if offline {
        tracing::warn!(
            component = "collector.start",
            phase = "offline_mode",
            "TP_OFFLINE=1 — frames go to the log only, WS pump disabled"
        );
        spawn_offline_sink(frame_rx);
    } else {
        tracing::info!(
            component = "collector.start",
            phase = "online_mode",
            server = %creds.server,
            collector_id = %creds.collector_id,
            socket = %socket_path.display(),
            "starting WS pump"
        );
        let creds_clone = creds.clone();
        tokio::spawn(async move {
            if let Err(e) = ws_client::pump(creds_clone, frame_rx).await {
                tracing::error!(
                    component = "collector.start",
                    phase = "ws_pump_exited",
                    error = %e,
                );
            }
        });
    }

    tracing::info!(
        component = "collector.start",
        phase = "ready",
        server = %creds.server,
        muted = mute::is_muted(),
        "listening for hook events"
    );

    while let Some(evt) = hook_rx.recv().await {
        match evt {
            HookEvent::SessionStart { payload } => {
                let session_id = session_uuid(payload.session_id.as_deref());
                let cwd = payload.cwd.clone().unwrap_or_else(|| "?".into());
                let transcript_path = payload.transcript_path.clone();

                sessions.add(session_id);

                let _ = frame_tx
                    .send(Frame::SessionStart {
                        session_id,
                        cli: agent_kind,
                        cwd: cwd.clone(),
                        git_remote: None,
                        git_branch: None,
                        transcript_path: transcript_path.as_ref().map(|p| p.display().to_string()),
                        started_at: Utc::now(),
                    })
                    .await;

                if let Some(path) = transcript_path {
                    spawn_tailer(session_id, path, frame_tx.clone());
                } else {
                    tracing::warn!(
                        component = "collector.start",
                        phase = "no_transcript",
                        session_id = %session_id,
                        "SessionStart without transcript_path — content will not be captured"
                    );
                }
            }
            HookEvent::Stop { payload } => {
                // Claude Code's `Stop` hook fires at the end of every
                // assistant turn, not at session termination. Treat it as
                // a no-op: the session stays active until the collector
                // process exits or the transcript file goes missing. The
                // server reaper flips stale sessions to offline after the
                // heartbeat grace window, which is the authoritative signal.
                let session_id = session_uuid(payload.session_id.as_deref());
                tracing::trace!(
                    component = "collector.start",
                    phase = "stop_noop",
                    session_id = %session_id,
                );
            }
        }
    }
    Ok(())
}

/// Kept as a thin wrapper around `run` so existing call sites and docs that
/// reference "offline mode" still compile; `TP_OFFLINE=1` is the switch.
pub async fn run_offline(creds: Credentials) -> anyhow::Result<()> {
    std::env::set_var("TP_OFFLINE", "1");
    run(creds, AgentKind::ClaudeCode).await
}

fn spawn_offline_sink(mut frame_rx: mpsc::Receiver<Frame>) {
    tokio::spawn(async move {
        while let Some(frame) = frame_rx.recv().await {
            log_frame(&frame);
        }
    });
}

fn log_frame(frame: &Frame) {
    match frame {
        Frame::SessionContent {
            role,
            text,
            session_id,
            ..
        } => tracing::info!(
            component = "collector.sink",
            phase = "content_frame",
            session_id = %session_id,
            role = ?role,
            bytes = text.0.len(),
            "(offline) content frame"
        ),
        Frame::SessionStart {
            session_id, cwd, ..
        } => tracing::info!(
            component = "collector.sink",
            phase = "session_start",
            session_id = %session_id,
            cwd = %cwd,
            "(offline) session started"
        ),
        Frame::SessionEnd { session_id, .. } => tracing::info!(
            component = "collector.sink",
            phase = "session_end",
            session_id = %session_id,
            "(offline) session ended"
        ),
        Frame::Heartbeat {
            muted,
            active_session_ids,
            ..
        } => tracing::debug!(
            component = "collector.sink",
            phase = "heartbeat",
            muted,
            active = active_session_ids.len(),
        ),
    }
}

fn spawn_tailer(session_id: uuid::Uuid, path: PathBuf, frame_tx: mpsc::Sender<Frame>) {
    let gated_tx = spawn_mute_gate(frame_tx);
    let tailer = Tailer::new(session_id, path, gated_tx);
    tokio::spawn(async move {
        if let Err(e) = tailer.run().await {
            tracing::warn!(
                component = "collector.start",
                phase = "tailer_err",
                session_id = %session_id,
                error = %e,
            );
        }
    });
}

/// Wraps an outbound frame sender with a mute check. Heartbeats + lifecycle
/// frames are allowed through; content frames are dropped while muted.
fn spawn_mute_gate(downstream: mpsc::Sender<Frame>) -> mpsc::Sender<Frame> {
    let (up_tx, mut up_rx) = mpsc::channel::<Frame>(128);
    tokio::spawn(async move {
        while let Some(frame) = up_rx.recv().await {
            if mute::is_muted() && matches!(frame, Frame::SessionContent { .. }) {
                continue;
            }
            if downstream.send(frame).await.is_err() {
                break;
            }
        }
    });
    up_tx
}
