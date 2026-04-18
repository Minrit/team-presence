//! Coarse mute state. Presence of the flag file == muted; absence == unmuted.
//! File-backed (not a process-local flag) so the `mute` / `unmute` subcommands
//! flip state without needing a running daemon to talk to.

use std::path::Path;

use crate::config::mute_flag_path;

pub fn is_muted() -> bool {
    mute_flag_path().map(|p| p.exists()).unwrap_or(false)
}

pub fn is_muted_at(path: &Path) -> bool {
    path.exists()
}

pub fn mute() -> anyhow::Result<()> {
    let path = mute_flag_path()?;
    if !path.exists() {
        std::fs::write(&path, b"")?;
    }
    Ok(())
}

pub fn unmute() -> anyhow::Result<()> {
    let path = mute_flag_path()?;
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn flag_toggle_via_at_helpers() {
        let tmp = TempDir::new().unwrap();
        let flag = tmp.path().join("muted");
        assert!(!is_muted_at(&flag));
        std::fs::write(&flag, b"").unwrap();
        assert!(is_muted_at(&flag));
        std::fs::remove_file(&flag).unwrap();
        assert!(!is_muted_at(&flag));
    }
}
