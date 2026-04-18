//! End-to-end test for the install.sh template (plan 010 Unit 3).
//!
//! Boots a minimal downloads router on an ephemeral port, writes a fake
//! manifest + fake tp-mcp binary into a tempdir, then actually executes
//! the rendered install.sh via `sh` and checks that the fake binary
//! lands in the target install dir with the right bytes and permissions.
//!
//! The script is rendered locally (via `install_script::render`) rather
//! than fetched over HTTP, so a single test only stresses one round-trip
//! (the script's own `curl ... /manifest.json` and `curl ... /download/...`).

use std::{
    fs,
    os::unix::fs::PermissionsExt,
    path::Path,
    process::Command,
    sync::Arc,
    time::Duration,
};

use axum::serve;
use team_presence_server::downloads::{self, install_script};
use tempfile::tempdir;

fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    digest.iter().map(|b| format!("{:02x}", b)).collect()
}

fn native_target() -> (&'static str, &'static str) {
    let os = if cfg!(target_os = "macos") {
        "darwin"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else {
        panic!("install.sh test only runs on macOS or Linux");
    };
    let arch = if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else if cfg!(target_arch = "x86_64") {
        "x86_64"
    } else {
        panic!("install.sh test only runs on aarch64 or x86_64");
    };
    (os, arch)
}

fn populate_downloads(dir: &Path) -> Vec<u8> {
    let (os, arch) = native_target();
    let name = format!("tp-mcp-{os}-{arch}");
    let bytes: Vec<u8> = b"#!/bin/sh\necho fake-tp-mcp\n".to_vec();
    fs::write(dir.join(&name), &bytes).unwrap();
    let sha = sha256_hex(&bytes);
    let manifest = format!(
        r#"{{
  "version": "0.0.0+test",
  "generated_at": "2026-04-18T00:00:00Z",
  "artifacts": [
    {{ "os": "{os}", "arch": "{arch}", "path": "/download/{name}", "sha256": "{sha}", "size": {size} }}
  ]
}}
"#,
        size = bytes.len()
    );
    fs::write(dir.join("manifest.json"), manifest).unwrap();
    bytes
}

/// Bind an axum router to 127.0.0.1:0, return (base_url, shutdown_token).
async fn spawn_server(dir_path: std::path::PathBuf) -> (String, tokio::sync::oneshot::Sender<()>) {
    let state = downloads::DownloadsState {
        dir: Arc::new(dir_path),
    };
    let app = downloads::router().with_state(state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let (tx, rx) = tokio::sync::oneshot::channel::<()>();
    tokio::spawn(async move {
        serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = rx.await;
            })
            .await
            .ok();
    });
    // Give the OS a beat to make the socket accept()-ready.
    tokio::time::sleep(Duration::from_millis(50)).await;
    (format!("http://{}", addr), tx)
}

fn run_script(script: &str, tp_server: &str, install_dir: &Path) -> std::process::Output {
    Command::new("sh")
        .arg("-c")
        .arg(script)
        .env("TP_SERVER", tp_server)
        .env("TP_INSTALL_DIR", install_dir)
        .env("HOME", install_dir)
        .output()
        .expect("sh is available on every dev host")
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn install_sh_lands_binary_with_correct_bytes() {
    if cfg!(windows) {
        eprintln!("skipping: install.sh is POSIX only");
        return;
    }
    let dl_dir = tempdir().unwrap();
    let expected = populate_downloads(dl_dir.path());
    let (base, _stop) = spawn_server(dl_dir.path().to_path_buf()).await;
    let script = install_script::render(&base);
    assert!(script.starts_with("#!/bin/sh"));

    let install_dir = tempdir().unwrap();
    let out = run_script(&script, &base, install_dir.path());
    assert!(
        out.status.success(),
        "install.sh failed ({:?})\n--- stdout ---\n{}\n--- stderr ---\n{}",
        out.status,
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr),
    );

    let installed = install_dir.path().join("tp-mcp");
    assert!(installed.exists(), "tp-mcp not created at {:?}", installed);
    let got = fs::read(&installed).unwrap();
    assert_eq!(got, expected, "binary bytes differ");
    let mode = fs::metadata(&installed).unwrap().permissions().mode();
    assert!(mode & 0o111 != 0, "binary not executable (mode {:o})", mode);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn install_sh_rejects_checksum_mismatch() {
    if cfg!(windows) {
        return;
    }
    let dl_dir = tempdir().unwrap();
    populate_downloads(dl_dir.path());
    // Overwrite manifest.json with a sha of all zeros so the download
    // never matches.
    let (os, arch) = native_target();
    let bytes = fs::read(dl_dir.path().join(format!("tp-mcp-{os}-{arch}"))).unwrap();
    let bogus = format!(
        r#"{{
  "version": "bad",
  "generated_at": "2026-04-18T00:00:00Z",
  "artifacts": [
    {{ "os": "{os}", "arch": "{arch}", "path": "/download/tp-mcp-{os}-{arch}", "sha256": "{sha}", "size": {size} }}
  ]
}}
"#,
        sha = "0".repeat(64),
        size = bytes.len(),
    );
    fs::write(dl_dir.path().join("manifest.json"), bogus).unwrap();

    let (base, _stop) = spawn_server(dl_dir.path().to_path_buf()).await;
    let script = install_script::render(&base);

    let install_dir = tempdir().unwrap();
    let out = run_script(&script, &base, install_dir.path());
    assert!(!out.status.success(), "install.sh should fail on sha mismatch");
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(
        stderr.contains("checksum mismatch"),
        "expected checksum-mismatch diagnostic, got stderr:\n{stderr}"
    );
    assert!(
        !install_dir.path().join("tp-mcp").exists(),
        "tp-mcp must not be installed on checksum failure"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn install_sh_is_idempotent() {
    if cfg!(windows) {
        return;
    }
    let dl_dir = tempdir().unwrap();
    let expected = populate_downloads(dl_dir.path());
    let (base, _stop) = spawn_server(dl_dir.path().to_path_buf()).await;
    let script = install_script::render(&base);
    let install_dir = tempdir().unwrap();

    assert!(run_script(&script, &base, install_dir.path()).status.success());
    assert!(run_script(&script, &base, install_dir.path()).status.success());

    let got = fs::read(install_dir.path().join("tp-mcp")).unwrap();
    assert_eq!(got, expected);
    let leaked: Vec<_> = fs::read_dir(install_dir.path())
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_name()
                .to_string_lossy()
                .starts_with("tp-mcp.download.")
        })
        .collect();
    assert!(leaked.is_empty(), "leaked tempfiles: {:?}", leaked);
}
