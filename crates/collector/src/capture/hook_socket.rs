//! Unix socket that claude-code hook scripts pipe event JSON into.
//!
//! Wire contract: one JSON object per line. Each line is independently parsed;
//! malformed lines are logged-and-skipped. See `HookEvent::try_parse`.
//!
//! Perm enforcement: socket file chmod 0600 after bind so only the same uid
//! can connect. Peer-uid verification is belt-and-braces on top of that, gated
//! by target_os (getpeereid on macOS, SO_PEERCRED on Linux).

use std::os::unix::io::AsRawFd;
use std::path::Path;

use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::net::{UnixListener, UnixStream};
use tokio::sync::mpsc;

use super::HookEvent;
use crate::config::set_mode;

/// Bind the socket, returning the listener ready to accept.
///
/// Removes any stale socket file from a previous (possibly crashed) run —
/// safe because the socket path is in /tmp and namespaced by uid.
pub fn bind(socket_path: &Path) -> anyhow::Result<UnixListener> {
    if socket_path.exists() {
        std::fs::remove_file(socket_path).ok();
    }
    let listener = UnixListener::bind(socket_path)?;
    set_mode(socket_path, 0o600)?;
    tracing::info!(
        component = "collector.hook_socket",
        phase = "bound",
        path = %socket_path.display(),
        "hook socket ready"
    );
    Ok(listener)
}

/// Accept loop. Forwards parsed events onto `tx`. Each connection is one or
/// more newline-delimited JSON objects, then EOF; the hook shell scripts
/// connect per event so connections are short-lived.
pub async fn run(listener: UnixListener, tx: mpsc::Sender<HookEvent>) -> anyhow::Result<()> {
    loop {
        let (stream, _addr) = match listener.accept().await {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!(
                    component = "collector.hook_socket",
                    phase = "accept_err",
                    error = %e,
                    "accept failed"
                );
                continue;
            }
        };

        // Best-effort peer check. On unsupported targets this is a no-op.
        if let Err(e) = verify_peer(&stream) {
            tracing::warn!(
                component = "collector.hook_socket",
                phase = "peer_reject",
                error = %e,
                "rejecting peer"
            );
            continue;
        }

        let tx2 = tx.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream, tx2).await {
                tracing::debug!(
                    component = "collector.hook_socket",
                    phase = "conn_err",
                    error = %e,
                    "connection closed with error"
                );
            }
        });
    }
}

async fn handle_connection(stream: UnixStream, tx: mpsc::Sender<HookEvent>) -> anyhow::Result<()> {
    let reader = BufReader::new(stream);
    let mut lines = reader.lines();
    while let Some(line) = lines.next_line().await? {
        match HookEvent::try_parse(&line) {
            Some(evt) => {
                if tx.send(evt).await.is_err() {
                    break; // consumer gone
                }
            }
            None => {
                tracing::debug!(
                    component = "collector.hook_socket",
                    phase = "parse_skip",
                    len = line.len(),
                    "unparseable line dropped"
                );
            }
        }
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn verify_peer(stream: &UnixStream) -> anyhow::Result<()> {
    let fd = stream.as_raw_fd();
    let mut uid: libc::uid_t = 0;
    let mut gid: libc::gid_t = 0;
    // getpeereid: int getpeereid(int s, uid_t *euid, gid_t *egid);
    let rc = unsafe { libc::getpeereid(fd, &mut uid, &mut gid) };
    if rc != 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    let me = unsafe { libc::getuid() };
    if uid != me {
        anyhow::bail!("peer uid {uid} ≠ local uid {me}");
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn verify_peer(stream: &UnixStream) -> anyhow::Result<()> {
    use std::mem::size_of;
    let fd = stream.as_raw_fd();
    #[repr(C)]
    struct Ucred {
        pid: libc::pid_t,
        uid: libc::uid_t,
        gid: libc::gid_t,
    }
    let mut cred = Ucred {
        pid: 0,
        uid: 0,
        gid: 0,
    };
    let mut len = size_of::<Ucred>() as libc::socklen_t;
    // SO_PEERCRED is Linux-only.
    let rc = unsafe {
        libc::getsockopt(
            fd,
            libc::SOL_SOCKET,
            libc::SO_PEERCRED,
            &mut cred as *mut _ as *mut libc::c_void,
            &mut len,
        )
    };
    if rc != 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    let me = unsafe { libc::getuid() };
    if cred.uid != me {
        anyhow::bail!("peer uid {} ≠ local uid {}", cred.uid, me);
    }
    Ok(())
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn verify_peer(_stream: &UnixStream) -> anyhow::Result<()> {
    tracing::warn!(
        component = "collector.hook_socket",
        phase = "peer_check_skipped",
        "peer uid check unsupported on this platform; socket perms only"
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;
    use tempfile::TempDir;
    use tokio::io::AsyncWriteExt;

    #[tokio::test]
    async fn bind_creates_0600_socket() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("h.sock");
        let _listener = bind(&path).unwrap();
        let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600, "socket should be 0600, got {:o}", mode);
    }

    #[tokio::test]
    async fn bind_reclaims_stale_socket() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("h.sock");
        let _first = bind(&path).unwrap();
        drop(_first);
        // Socket file still exists on disk after listener drop; bind() must remove it.
        let _second = bind(&path).expect("should reclaim stale socket");
    }

    #[tokio::test]
    async fn end_to_end_parses_lines() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("h.sock");
        let listener = bind(&path).unwrap();
        let (tx, mut rx) = mpsc::channel(8);

        let server = tokio::spawn(run(listener, tx));

        let mut stream = UnixStream::connect(&path).await.unwrap();
        stream
            .write_all(
                b"{\"kind\":\"session_start\",\"payload\":{\"session_id\":\"a\",\"cwd\":\"/tmp\"}}\ngarbage\n{\"kind\":\"stop\",\"payload\":{\"session_id\":\"a\"}}\n",
            )
            .await
            .unwrap();
        stream.shutdown().await.unwrap();

        let first = rx.recv().await.expect("first event");
        assert!(matches!(first, HookEvent::SessionStart { .. }));
        let second = rx.recv().await.expect("second event");
        assert!(matches!(second, HookEvent::Stop { .. }));

        server.abort();
    }
}
