//! Heartbeat emitter. Emits a `Frame::Heartbeat` every 30 s so the server can
//! detect stale collectors (plan says server flips a session to offline after
//! 90 s without a heartbeat).

use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::Utc;
use team_presence_shared_types::Frame;
use tokio::sync::mpsc;
use uuid::Uuid;

pub const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(30);

/// Tracks which sessions are currently active. Updated by the start coordinator
/// on session_start / session_end. Cloneable: share between the coordinator
/// and the heartbeat task.
#[derive(Clone, Default)]
pub struct ActiveSessions(Arc<Mutex<Vec<Uuid>>>);

impl ActiveSessions {
    pub fn add(&self, id: Uuid) {
        let mut g = self.0.lock().unwrap();
        if !g.contains(&id) {
            g.push(id);
        }
    }

    pub fn remove(&self, id: Uuid) {
        let mut g = self.0.lock().unwrap();
        g.retain(|x| *x != id);
    }

    pub fn snapshot(&self) -> Vec<Uuid> {
        self.0.lock().unwrap().clone()
    }
}

pub async fn run(
    sessions: ActiveSessions,
    tx: mpsc::Sender<Frame>,
    is_muted: impl Fn() -> bool + Send + 'static,
) {
    let mut interval = tokio::time::interval(HEARTBEAT_INTERVAL);
    interval.tick().await; // fire first tick immediately
    loop {
        let frame = Frame::Heartbeat {
            sent_at: Utc::now(),
            active_session_ids: sessions.snapshot(),
            muted: is_muted(),
        };
        if tx.send(frame).await.is_err() {
            break;
        }
        interval.tick().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn active_sessions_dedup_and_remove() {
        let a = ActiveSessions::default();
        let id = Uuid::new_v4();
        a.add(id);
        a.add(id);
        assert_eq!(a.snapshot().len(), 1);
        a.remove(id);
        assert!(a.snapshot().is_empty());
    }

    #[tokio::test]
    async fn emits_heartbeat_frames() {
        let a = ActiveSessions::default();
        a.add(Uuid::new_v4());
        let (tx, mut rx) = mpsc::channel(2);
        let handle = tokio::spawn(run(a, tx, || false));

        let frame = tokio::time::timeout(Duration::from_secs(2), rx.recv())
            .await
            .expect("timeout")
            .expect("channel open");
        match frame {
            Frame::Heartbeat {
                muted,
                active_session_ids,
                ..
            } => {
                assert!(!muted);
                assert_eq!(active_session_ids.len(), 1);
            }
            _ => panic!("expected heartbeat"),
        }
        handle.abort();
    }
}
