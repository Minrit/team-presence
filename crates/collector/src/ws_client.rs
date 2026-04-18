//! WebSocket pump for collector → server.
//!
//! Unit 7 (server WS ingestion) is the matching half. Until that lands, the
//! pump will get connection-refused on every attempt; the reconnect loop
//! makes that noisy-but-survivable and the server-side can go live without
//! the collector needing a rebuild.
//!
//! Wire format: one shared-types `Frame` per WebSocket text message, JSON.
//! A future variant could switch to `Binary` for efficiency; the shape on
//! the wire is JSON either way.

use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use team_presence_shared_types::Frame;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::handshake::client::Request;
use tokio_tungstenite::tungstenite::http::HeaderValue;
use tokio_tungstenite::tungstenite::Message;

use crate::credentials::Credentials;

/// Backoff ladder. The max caps reconnect pressure so we don't drown ops in
/// reconnect logs while still recovering within a minute once the server is
/// back up.
const BACKOFF_LADDER: &[Duration] = &[
    Duration::from_secs(1),
    Duration::from_secs(2),
    Duration::from_secs(4),
    Duration::from_secs(8),
    Duration::from_secs(15),
    Duration::from_secs(30),
    Duration::from_secs(60),
];

pub fn ws_url_for(server: &str) -> String {
    let base = server.trim_end_matches('/');
    if let Some(rest) = base.strip_prefix("https://") {
        format!("wss://{rest}/ws/collector")
    } else if let Some(rest) = base.strip_prefix("http://") {
        format!("ws://{rest}/ws/collector")
    } else {
        // Caller already validated with url::Url; assume http for bare hosts.
        format!("ws://{base}/ws/collector")
    }
}

fn build_request(url: &str, token: &str) -> anyhow::Result<Request> {
    let mut request = url.into_client_request()?;
    let auth = HeaderValue::from_str(&format!("Bearer {token}"))?;
    request.headers_mut().insert("Authorization", auth);
    Ok(request)
}

/// Drain `rx` onto the server. Runs indefinitely: connect, pump, reconnect.
///
/// Fatal conditions (401 unauthorized) log a clear message and stop the loop;
/// everything else backs off and retries.
pub async fn pump(creds: Credentials, mut rx: mpsc::Receiver<Frame>) -> anyhow::Result<()> {
    let url = ws_url_for(&creds.server);
    let mut backoff_idx = 0usize;
    let mut last_received: Option<Frame> = None;

    loop {
        match build_request(&url, &creds.token) {
            Ok(request) => {
                tracing::info!(
                    component = "collector.ws",
                    phase = "connect",
                    url = %url,
                    "connecting"
                );
                match tokio_tungstenite::connect_async(request).await {
                    Ok((ws, _resp)) => {
                        backoff_idx = 0;
                        let (mut sink, mut stream) = ws.split();

                        // Drain any frame we had buffered from the previous
                        // connection that never got ack'd.
                        if let Some(frame) = last_received.take() {
                            if let Err(e) = send_frame(&mut sink, &frame).await {
                                tracing::warn!(
                                    component = "collector.ws",
                                    phase = "replay_failed",
                                    error = %e,
                                );
                                last_received = Some(frame);
                                continue;
                            }
                        }

                        loop {
                            tokio::select! {
                                maybe_frame = rx.recv() => {
                                    let Some(frame) = maybe_frame else {
                                        tracing::info!(component = "collector.ws", phase = "sender_closed", "channel closed; exiting pump");
                                        let _ = sink.send(Message::Close(None)).await;
                                        return Ok(());
                                    };
                                    if let Err(e) = send_frame(&mut sink, &frame).await {
                                        tracing::warn!(
                                            component = "collector.ws",
                                            phase = "send_failed",
                                            error = %e,
                                            "send failed; will reconnect"
                                        );
                                        last_received = Some(frame);
                                        break;
                                    }
                                }
                                incoming = stream.next() => {
                                    match incoming {
                                        Some(Ok(Message::Close(f))) => {
                                            tracing::info!(
                                                component = "collector.ws",
                                                phase = "server_close",
                                                code = ?f.as_ref().map(|c| c.code),
                                                "server closed WS"
                                            );
                                            break;
                                        }
                                        Some(Ok(Message::Ping(p))) => {
                                            let _ = sink.send(Message::Pong(p)).await;
                                        }
                                        Some(Ok(_)) => {} // ignore text/binary from server for MVP
                                        Some(Err(e)) => {
                                            tracing::warn!(component = "collector.ws", phase = "read_err", error = %e);
                                            break;
                                        }
                                        None => break,
                                    }
                                }
                            }
                        }
                    }
                    Err(tokio_tungstenite::tungstenite::Error::Http(resp))
                        if resp.status() == 401 =>
                    {
                        tracing::error!(
                            component = "collector.ws",
                            phase = "unauthorized",
                            "server returned 401 — token may be revoked; run `team-presence login` again"
                        );
                        return Err(anyhow::anyhow!("token rejected (401)"));
                    }
                    Err(e) => {
                        tracing::warn!(
                            component = "collector.ws",
                            phase = "connect_err",
                            error = %e,
                            "connect failed; backing off"
                        );
                    }
                }
            }
            Err(e) => {
                tracing::error!(
                    component = "collector.ws",
                    phase = "bad_request",
                    error = %e,
                );
                return Err(e);
            }
        }

        let delay = BACKOFF_LADDER[backoff_idx.min(BACKOFF_LADDER.len() - 1)];
        backoff_idx = (backoff_idx + 1).min(BACKOFF_LADDER.len() - 1);
        tokio::time::sleep(delay).await;
    }
}

async fn send_frame<S>(sink: &mut S, frame: &Frame) -> anyhow::Result<()>
where
    S: SinkExt<Message, Error = tokio_tungstenite::tungstenite::Error> + Unpin,
{
    let json = serde_json::to_string(frame)?;
    sink.send(Message::Text(json)).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn https_becomes_wss() {
        assert_eq!(
            ws_url_for("https://example.com"),
            "wss://example.com/ws/collector"
        );
    }

    #[test]
    fn http_becomes_ws() {
        assert_eq!(
            ws_url_for("http://example.com:8080"),
            "ws://example.com:8080/ws/collector"
        );
    }

    #[test]
    fn trailing_slash_tolerated() {
        assert_eq!(
            ws_url_for("https://example.com/"),
            "wss://example.com/ws/collector"
        );
    }

    #[test]
    fn bare_host_assumes_ws() {
        assert_eq!(
            ws_url_for("localhost:8080"),
            "ws://localhost:8080/ws/collector"
        );
    }

    #[test]
    fn bearer_header_applied() {
        let req = build_request("ws://x/a", "tp_abc").unwrap();
        let auth = req
            .headers()
            .get("Authorization")
            .unwrap()
            .to_str()
            .unwrap();
        assert_eq!(auth, "Bearer tp_abc");
    }

    #[test]
    fn backoff_ladder_monotonically_non_decreasing() {
        for pair in BACKOFF_LADDER.windows(2) {
            assert!(pair[1] >= pair[0]);
        }
        assert_eq!(*BACKOFF_LADDER.last().unwrap(), Duration::from_secs(60));
    }
}
