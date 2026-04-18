//! `team-presence start` runtime — wires hook socket → transcript tailers →
//! Frame sink. Phase B produces frames; Phase C will swap the stdout sink for
//! a WebSocket pump. The signature of `run_offline` stays stable so the swap
//! is additive.

use std::path::PathBuf;

use chrono::Utc;
use team_presence_shared_types::{CliKind, Frame};
use tokio::sync::mpsc;

use crate::capture::{hook_socket, session_uuid, transcript::Tailer, HookEvent};
use crate::config;
use crate::credentials::Credentials;
use crate::mute;

/// Run the collector pipeline without a server connection. Frames are logged
/// at info level so dogfood testing works before Unit 7 ships.
pub async fn run_offline(creds: Credentials) -> anyhow::Result<()> {
    let socket_path = config::hook_socket_path();
    let listener = hook_socket::bind(&socket_path)?;
    let (hook_tx, mut hook_rx) = mpsc::channel::<HookEvent>(64);
    let (frame_tx, mut frame_rx) = mpsc::channel::<Frame>(256);

    let _hook_loop = tokio::spawn(hook_socket::run(listener, hook_tx));

    let frame_tx_for_consumer = frame_tx.clone();
    let consumer = tokio::spawn(async move {
        while let Some(frame) = frame_rx.recv().await {
            match &frame {
                Frame::SessionContent {
                    role,
                    text,
                    session_id,
                    ..
                } => {
                    tracing::info!(
                        component = "collector.sink",
                        phase = "content_frame",
                        session_id = %session_id,
                        role = ?role,
                        bytes = text.0.len(),
                        "(offline sink) content frame"
                    );
                }
                Frame::SessionStart {
                    session_id, cwd, ..
                } => {
                    tracing::info!(
                        component = "collector.sink",
                        phase = "session_start",
                        session_id = %session_id,
                        cwd = %cwd,
                        "(offline sink) session started"
                    );
                }
                Frame::SessionEnd { session_id, .. } => {
                    tracing::info!(
                        component = "collector.sink",
                        phase = "session_end",
                        session_id = %session_id,
                        "(offline sink) session ended"
                    );
                }
                Frame::Heartbeat {
                    muted,
                    active_session_ids,
                    ..
                } => {
                    tracing::debug!(
                        component = "collector.sink",
                        phase = "heartbeat",
                        muted,
                        active = active_session_ids.len(),
                    );
                }
            }
        }
        // Keep reference live so sender half doesn't close early.
        drop(frame_tx_for_consumer);
    });

    tracing::info!(
        component = "collector.start",
        phase = "ready",
        server = %creds.server,
        collector_id = %creds.collector_id,
        muted = mute::is_muted(),
        socket = %socket_path.display(),
        "offline mode — content frames print to the log; Unit 7 WS pump lands with Phase C"
    );

    while let Some(evt) = hook_rx.recv().await {
        match evt {
            HookEvent::SessionStart { payload } => {
                let session_id = session_uuid(payload.session_id.as_deref());
                let cwd = payload.cwd.clone().unwrap_or_else(|| "?".into());
                let transcript_path = payload.transcript_path.clone();

                let _ = frame_tx
                    .send(Frame::SessionStart {
                        session_id,
                        cli: CliKind::ClaudeCode,
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
                let session_id = session_uuid(payload.session_id.as_deref());
                let _ = frame_tx
                    .send(Frame::SessionEnd {
                        session_id,
                        ended_at: Utc::now(),
                        exit_code: None,
                    })
                    .await;
            }
        }
    }

    // Graceful drain — hook loop never returns in practice, but cover the path.
    drop(frame_tx);
    consumer.await.ok();
    Ok(())
}

fn spawn_tailer(session_id: uuid::Uuid, path: PathBuf, frame_tx: mpsc::Sender<Frame>) {
    // If we're muted at Start time we still spawn the tailer so a later
    // `unmute` doesn't need to re-attach — instead the per-frame gate below
    // drops content while muted.
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
